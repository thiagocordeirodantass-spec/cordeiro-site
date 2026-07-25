import crypto from "node:crypto";
import { ensureSchema, pool } from "./_database.js";

function parts(request) {
  const value = request.query.route;
  return Array.isArray(value) ? value : String(value || "").split("/").filter(Boolean);
}
function token(request) {
  const match = String(request.headers.cookie || "").match(/(?:^|;\s*)sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
async function authenticated(request) {
  const sid = token(request);
  if (!sid) return null;
  const result = await pool.query(
    `SELECT u.*,s.empresa_ativa_id FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.id=$1 AND s.expires_at>NOW() AND u.ativo=TRUE`,
    [sid],
  );
  if(result.rowCount) await pool.query("UPDATE sessions SET last_seen_at=NOW() WHERE id=$1",[sid]);
  return result.rows[0] || null;
}
function hash(password) {
  const salt = crypto.randomBytes(16);
  return {
    salt: salt.toString("hex"),
    hash: crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex"),
  };
}
function feedback(row) {
  return {
    id: Number(row.id), userId: Number(row.user_id),
    username: row.anonimo ? "Anônimo" : row.username,
    categoria: row.categoria, assunto: row.assunto, mensagem: row.mensagem,
    anonimo: Boolean(row.anonimo), status: row.status, resposta: row.resposta,
    respondidoPor: row.respondido_por, respondidoEm: row.respondido_em,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export default async function handler(request, response) {
  try {
    await ensureSchema();
    const route = parts(request);

    if (route[0] === "news" && request.method === "GET")
      return response.json({ externos: [], curadas: [] });

    const user = await authenticated(request);
    if (!user) return response.status(401).json({ error: "Não autenticado" });

    if(route[0]==="activity"&&request.method==="GET"){
      const empresaId=Number(request.headers["x-empresa-id"]||user.empresa_ativa_id);
      if(!empresaId)return response.json({items:[]});
      const result=await pool.query(`SELECT l.*,COALESCE(u.nome,l.username,'Usuário') usuario_nome
        FROM empresa_activity_log l LEFT JOIN users u ON u.id=l.user_id
        WHERE l.empresa_id=$1 ORDER BY l.created_at DESC LIMIT 300`,[empresaId]);
      return response.json({items:result.rows});
    }

    if (route[0] === "assistant") {
      if (route[1] === "status")
        return response.json({ available: true, provider: "local" });
      if (route[1] === "history")
        return response.json({ messages: [] });
      if (route[1] === "message" && request.method === "POST") {
        const text = String(request.body?.message || request.body?.mensagem || "");
        return response.json({
          answer: text.toLowerCase().includes("sefaz")
            ? "A integração SEFAZ está disponível somente para consultas, sem emissão de documentos."
            : "Posso ajudar com documentos, empresas, relatórios e navegação no Cordeiro Fiscal.",
        });
      }
    }

    if (route[0] === "certidoes") {
      if (route[1] === "config" && request.method === "GET") {
        const [config, destinatarios] = await Promise.all([
          pool.query("SELECT * FROM cnd_config WHERE id=1"),
          pool.query(`SELECT d.*,e.nome empresa_nome,e.empresa_matriz_id
            FROM cnd_destinatarios d JOIN empresas e ON e.id=d.empresa_id
            ORDER BY d.ativo DESC,e.nome,d.email`),
        ]);
        return response.json({ config: config.rows[0], destinatarios: destinatarios.rows });
      }
      if (route[1] === "config" && request.method === "PUT") {
        const d = request.body || {};
        const result = await pool.query(`UPDATE cnd_config SET
          prazo_alerta=$1,alertas_ativos=$2,alerta_vencimento=$3,alerta_vencidas=$4,
          alerta_positivas=$5,remetente=$6,updated_at=NOW() WHERE id=1 RETURNING *`,[
          Math.max(1,Math.min(365,Number(d.prazo_alerta||10))),Boolean(d.alertas_ativos),
          Boolean(d.alerta_vencimento),Boolean(d.alerta_vencidas),Boolean(d.alerta_positivas),
          String(d.remetente||"").trim()||null,
        ]);
        return response.json(result.rows[0]);
      }
      if (route[1] === "destinatarios" && route.length === 2 && request.method === "POST") {
        const empresaId=Number(request.body?.empresa_id), email=String(request.body?.email||"").trim().toLowerCase();
        if (!empresaId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return response.status(400).json({error:"Empresa e e-mail válido são obrigatórios"});
        const result=await pool.query(`INSERT INTO cnd_destinatarios(empresa_id,email,ativo)
          SELECT id,$2,TRUE FROM empresas WHERE id=$1 AND ativo=TRUE
          ON CONFLICT(empresa_id,email) DO UPDATE SET ativo=TRUE RETURNING *`,[empresaId,email]);
        if (!result.rowCount) return response.status(404).json({error:"Empresa ou filial não encontrada"});
        return response.json(result.rows[0]);
      }
      if (route[1] === "destinatarios" && Number.isInteger(Number(route[2])) && request.method === "DELETE") {
        await pool.query("DELETE FROM cnd_destinatarios WHERE id=$1",[Number(route[2])]);
        return response.json({ok:true});
      }
      if (route[1] === "enviar-teste" && request.method === "POST") {
        const result=await pool.query("SELECT COUNT(*)::int total FROM cnd_destinatarios WHERE ativo=TRUE");
        if (!result.rows[0].total) return response.status(400).json({error:"Cadastre ao menos um destinatário ativo"});
        return response.json({ok:true,enviados:result.rows[0].total,message:"Teste registrado para envio"});
      }
      if (route[1] === "stats" && request.method === "GET") {
        const empresaId=Number(request.headers["x-empresa-id"]||request.query.empresaId||0);
        const result = await pool.query(
          `SELECT COUNT(*)::int total,
            COUNT(*) FILTER(WHERE status='negativa')::int negativas,
            COUNT(*) FILTER(WHERE status='positiva')::int positivas,
            COUNT(*) FILTER(WHERE status='positiva_com_efeitos_de_negativa')::int com_efeitos,
            COUNT(*) FILTER(WHERE data_validade < CURRENT_DATE)::int vencidas,
            COUNT(*) FILTER(WHERE data_validade BETWEEN CURRENT_DATE AND CURRENT_DATE+30)::int vencendo
           FROM certidoes WHERE ($1::bigint=0 OR empresa_id=$1)`,[empresaId],
        );
        return response.json(result.rows[0]);
      }
      if (route.length === 1 && request.method === "GET") {
        const empresaId=Number(request.headers["x-empresa-id"]||request.query.empresaId||0);
        const result = await pool.query(`SELECT c.*,COALESCE(e.nome,c.empresa_nome,'Empresa ativa') empresa_nome
          FROM certidoes c LEFT JOIN empresas e ON e.id=c.empresa_id
          WHERE ($1::bigint=0 OR c.empresa_id=$1) ORDER BY data_validade ASC NULLS LAST`,[empresaId]);
        return response.json(result.rows.map(row=>({
          ...row,pdf_data:undefined,pdf_url:row.pdf_data?`/api/certidoes/${row.id}/pdf`:null,
        })));
      }
      if (route.length === 1 && request.method === "POST") {
        const d = request.body || {};
        const result = await pool.query(
          `INSERT INTO certidoes(user_id,empresa_id,tipo,status,numero_certidao,empresa_nome,data_emissao,data_validade,
            observacoes,alerta_modo,alerta_dias,alerta_dia_semana,alerta_dia_mes)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [user.id,Number(d.empresaId||request.headers["x-empresa-id"]||user.empresa_ativa_id)||null,d.tipo||null,d.status||"negativa",
           d.numeroCertidao||d.numero_certidao||null,d.empresaNome||d.empresa_nome||"Empresa ativa",
           d.dataEmissao||d.data_emissao||null,d.dataValidade||d.data_validade||null,d.observacoes||null,
           d.alertaModo||"dias",Number(d.alertaDias||10),d.alertaDiaSemana===""?null:Number(d.alertaDiaSemana),
           d.alertaDiaMes===""?null:Number(d.alertaDiaMes)],
        );
        return response.json(result.rows[0]);
      }
      const certidaoId = Number(route[1]);
      if (Number.isInteger(certidaoId) && request.method === "PUT") {
        const d = request.body || {};
        const result = await pool.query(
          `UPDATE certidoes SET tipo=COALESCE($2,tipo),status=COALESCE($3,status),
            numero_certidao=COALESCE($4,numero_certidao),
            data_emissao=COALESCE($5,data_emissao),data_validade=COALESCE($6,data_validade),
            observacoes=COALESCE($7,observacoes),alerta_modo=COALESCE($8,alerta_modo),
            alerta_dias=COALESCE($9,alerta_dias),alerta_dia_semana=COALESCE($10,alerta_dia_semana),
            alerta_dia_mes=COALESCE($11,alerta_dia_mes) WHERE id=$1 RETURNING *`,
          [certidaoId,d.tipo||null,d.status||null,d.numeroCertidao||d.numero_certidao||null,
           d.dataEmissao||d.data_emissao||null,d.dataValidade||d.data_validade||null,d.observacoes||null,
           d.alertaModo||null,d.alertaDias?Number(d.alertaDias):null,
           d.alertaDiaSemana===""?null:Number(d.alertaDiaSemana),d.alertaDiaMes===""?null:Number(d.alertaDiaMes)],
        );
        return response.json(result.rows[0]);
      }
      if (Number.isInteger(certidaoId) && request.method === "DELETE") {
        await pool.query("DELETE FROM certidoes WHERE id=$1", [certidaoId]);
        return response.json({ ok: true });
      }
      if (Number.isInteger(certidaoId) && route[2] === "pdf")
        return response.status(501).json({ error: "Armazenamento de PDF será conectado ao Vercel Blob." });
      if (route[1] === "recognize")
        return response.status(422).json({ error: "Envie os dados da certidão manualmente neste ambiente." });
    }

    if (route[0] === "users") {
      if (user.role !== "admin")
        return response.status(403).json({ error: "Acesso restrito" });
      if (route.length === 1 && request.method === "GET") {
        const result = await pool.query(
          `SELECT u.id,u.username,u.nome,u.email,u.role,u.ativo,u.primeiro_login,u.ultimo_login,u.created_at,
            EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id AND s.expires_at>NOW()
              AND s.last_seen_at>NOW()-INTERVAL '90 seconds') online,
            eu.empresa_id,eu.permissoes FROM users u LEFT JOIN empresa_users eu ON eu.user_id=u.id
            ORDER BY u.nome,u.username`,
        );
        return response.json({ users: result.rows });
      }
      if (route.length === 1 && request.method === "POST") {
        const data = request.body || {};
        if (!data.username || !data.nome)
          return response.status(400).json({ error: "Nome e usuário obrigatórios" });
        const password = `Cord@${crypto.randomBytes(6).toString("hex")}`;
        const secret = hash(password);
        const result = await pool.query(
          `INSERT INTO users
            (username,nome,email,password_hash,password_salt,role,ativo,primeiro_login)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,TRUE) RETURNING id,username,nome,email,role,ativo`,
          [data.username, data.nome, data.email || null, secret.hash, secret.salt, data.role || "operador"],
        );
        if (data.empresaId)
          await pool.query(
            `INSERT INTO empresa_users(empresa_id,user_id,papel,permissoes) VALUES($1,$2,$3,$4::jsonb)
             ON CONFLICT(empresa_id,user_id) DO UPDATE SET ativo=TRUE,papel=EXCLUDED.papel,permissoes=EXCLUDED.permissoes`,
            [data.empresaId, result.rows[0].id, data.role || "operador",JSON.stringify(data.permissoes||{})],
          );
        return response.json({ user: result.rows[0], senhaTemporaria: password });
      }
      const id = Number(route[1]);
      if (Number.isInteger(id) && route[2] === "reset-password" && request.method === "POST") {
        const password = `Cord@${crypto.randomBytes(6).toString("hex")}`;
        const secret = hash(password);
        await pool.query(
          `UPDATE users SET password_hash=$2,password_salt=$3,primeiro_login=TRUE WHERE id=$1`,
          [id, secret.hash, secret.salt],
        );
        await pool.query("DELETE FROM sessions WHERE user_id=$1", [id]);
        return response.json({ ok: true, senhaTemporaria: password });
      }
      if (Number.isInteger(id) && request.method === "PUT") {
        const data = request.body || {};
        const result = await pool.query(
          `UPDATE users SET nome=COALESCE($2,nome),email=COALESCE($3,email),
             role=COALESCE($4,role),ativo=COALESCE($5,ativo)
           WHERE id=$1 RETURNING id,username,nome,email,role,ativo,ultimo_login`,
          [id, data.nome || null, data.email || null, data.role || null, data.ativo ?? null],
        );
        if(data.empresaId&&data.permissoes)await pool.query(
          "UPDATE empresa_users SET permissoes=$3::jsonb WHERE empresa_id=$1 AND user_id=$2",
          [data.empresaId,id,JSON.stringify(data.permissoes)]);
        return response.json(result.rows[0]);
      }
      if(route[1]==="activity"&&request.method==="GET"){
        const empresaId=Number(request.headers["x-empresa-id"]||user.empresa_ativa_id);
        const result=await pool.query(`SELECT l.*,COALESCE(u.nome,l.username) usuario_nome
          FROM empresa_activity_log l LEFT JOIN users u ON u.id=l.user_id
          WHERE l.empresa_id=$1 ORDER BY l.created_at DESC LIMIT 300`,[empresaId]);
        return response.json({items:result.rows});
      }
    }

    if (route[0] === "feedback") {
      if (route.length === 1 && request.method === "POST") {
        const data = request.body || {};
        if (!String(data.mensagem || "").trim())
          return response.status(400).json({ error: "Mensagem obrigatória" });
        const result = await pool.query(
          `INSERT INTO feedback(user_id,username,categoria,assunto,mensagem,anonimo)
           VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
          [user.id,user.username,data.categoria || "outro",data.assunto || null,
           String(data.mensagem).trim().slice(0,4000),Boolean(data.anonimo)],
        );
        return response.json({ ok: true, feedback: feedback(result.rows[0]) });
      }
      if (request.method === "GET" && (route[1] === "me" || user.role !== "admin")) {
        const result = await pool.query(
          "SELECT * FROM feedback WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200",
          [user.id],
        );
        return response.json(result.rows.map(feedback));
      }
      if (route.length === 1 && request.method === "GET") {
        const result = await pool.query("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 500");
        return response.json(result.rows.map(feedback));
      }
      const id = Number(route[1]);
      if (user.role === "admin" && Number.isInteger(id) && request.method === "PATCH") {
        const data = request.body || {};
        const result = await pool.query(
          `UPDATE feedback SET status=COALESCE($2,status),resposta=COALESCE($3,resposta),
             respondido_por=CASE WHEN $3::text IS NULL THEN respondido_por ELSE $4 END,
             respondido_em=CASE WHEN $3::text IS NULL THEN respondido_em ELSE NOW() END,
             updated_at=NOW() WHERE id=$1 RETURNING *`,
          [id,data.status || null,data.resposta || null,user.username],
        );
        return response.json({ ok: true, feedback: feedback(result.rows[0]) });
      }
      if (user.role === "admin" && Number.isInteger(id) && request.method === "DELETE") {
        await pool.query("DELETE FROM feedback WHERE id=$1", [id]);
        return response.json({ ok: true });
      }
    }

    if (route[0] === "messages") {
      if (route[1] === "users" && request.method === "GET") {
        const result = await pool.query(
          `SELECT u.id,u.username,u.nome,u.email,u.role,
             COUNT(m.id) FILTER(WHERE m.read_at IS NULL)::int AS unread
           FROM users u LEFT JOIN user_messages m
             ON m.sender_id=u.id AND m.recipient_id=$1
           WHERE u.ativo=TRUE AND u.id<>$1 GROUP BY u.id ORDER BY unread DESC,u.nome`,
          [user.id],
        );
        return response.json(result.rows);
      }
      if (route[1] === "thread" && request.method === "GET") {
        const other = Number(route[2]);
        await pool.query(
          "UPDATE user_messages SET read_at=NOW() WHERE sender_id=$1 AND recipient_id=$2 AND read_at IS NULL",
          [other,user.id],
        );
        const result = await pool.query(
          `SELECT * FROM user_messages WHERE
           (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)
           ORDER BY id LIMIT 300`,
          [user.id,other],
        );
        return response.json(result.rows);
      }
      if (route.length === 1 && request.method === "POST") {
        const recipient = Number(request.body?.recipientId);
        const content = String(request.body?.content || "").trim().slice(0,3000);
        if (!recipient || !content)
          return response.status(400).json({ error: "Destinatário e mensagem obrigatórios" });
        const result = await pool.query(
          `INSERT INTO user_messages(sender_id,recipient_id,content)
           VALUES($1,$2,$3) RETURNING *`,
          [user.id,recipient,content],
        );
        return response.json(result.rows[0]);
      }
    }

    if (route[0] === "sefaz" && route[1] === "cert" && route[2] === "listar") {
      const configured = Boolean(process.env.SEFAZ_PFX_BASE64 && process.env.SEFAZ_PFX_PASSWORD);
      return response.json({
        certificados: configured
          ? [{
              thumbprint: "vercel-secret",
              label: "INTECOM SERVIÇOS DE LOGÍSTICA LTDA",
              subject: `CNPJ ${process.env.SEFAZ_CNPJ || ""}`,
              issuer: "Certificado A1 protegido na Vercel",
            }]
          : [],
      });
    }

    if (
      route[0] === "sefaz" &&
      route[1] === "cert" &&
      route[2] === "periodo-auto" &&
      request.method === "POST"
    ) {
      if (!process.env.SEFAZ_PFX_BASE64 || !process.env.SEFAZ_PFX_PASSWORD)
        return response.status(503).json({ error: "Certificado A1 não configurado" });
      const { consultarPeriodoComCertificado } = await import(
        "../backend/services/sefaz-distribuicao.js"
      );
      const result = await consultarPeriodoComCertificado({
        pfx: Buffer.from(process.env.SEFAZ_PFX_BASE64, "base64"),
        passphrase: process.env.SEFAZ_PFX_PASSWORD,
        uf: process.env.SEFAZ_UF || "MG",
        ambiente: "producao",
        cnpjOuCpf: process.env.SEFAZ_CNPJ,
        ultNSUInicial: request.body?.ultNSUInicial || "0",
        dateFrom: request.body?.dateFrom,
        dateTo: request.body?.dateTo,
        maxIteracoes: 5,
      });
      let saved=0;
      for(const doc of result.docs){
        if(doc.xml.includes("<resNFe")||doc.xml.includes("<resEvento")) continue;
        const match=doc.xml.match(/<chNFe>([^<]+)<\/chNFe>/)||doc.xml.match(/<chCTe>([^<]+)<\/chCTe>/)||doc.xml.match(/Id="[A-Za-z]*(\d{44})"/);
        const chave=match?.[1]; if(!chave) continue;
        const kind=doc.xml.includes("<CTe")||doc.xml.includes("<cteProc")?"CTE":"NFE";
        const inserted=await pool.query(`INSERT INTO documents(empresa_id,kind,chave,status,xml_data,source,file_name,created_by)
          SELECT $1,$2,$3::text,'importado',$4,'sefaz-mtls-auto',$5,$6
          WHERE NOT EXISTS(SELECT 1 FROM documents WHERE chave=$3::text AND empresa_id IS NOT DISTINCT FROM $1)`,
          [user.empresa_ativa_id,kind,chave,doc.xml,`${chave}.xml`,user.id]);
        saved+=inserted.rowCount;
      }
      response.setHeader("X-Sefaz-Total", String(result.docs.length));
      response.setHeader("X-Sefaz-Salvos", String(saved));
      response.setHeader("X-Sefaz-UltNSU", String(result.ultNSU || ""));
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      return response.status(200).send(
        JSON.stringify({
          ok: true,
          documentos: result.docs.map((doc) => ({
            nsu: doc.nsu,
            schema: doc.schema,
            xml: doc.xml,
          })),
          ultNSU: result.ultNSU,
          atingiuFim: result.atingiuFim,
        }),
      );
    }

    if (
      route[0] === "consulta" &&
      ["nfe", "cte"].includes(route[1]) &&
      /^\d{44}$/.test(route[2] || "")
    ) {
      if (!process.env.SEFAZ_PFX_BASE64 || !process.env.SEFAZ_PFX_PASSWORD)
        return response.status(503).json({ error: "Certificado A1 não configurado" });
      const { consultarChaveComCertificado } = await import(
        "../backend/services/sefaz-distribuicao.js"
      );
      let xml=null,cancelled=false;
      try{
        xml = await consultarChaveComCertificado({
          pfx: Buffer.from(process.env.SEFAZ_PFX_BASE64, "base64"),
          passphrase: process.env.SEFAZ_PFX_PASSWORD,
          uf: process.env.SEFAZ_UF || "MG",
          ambiente: "producao",
          cnpjOuCpf: process.env.SEFAZ_CNPJ,
          chave: route[2],
        });
      }catch(error){
        if(/cStat 653|NF-e Cancelada/i.test(error.message||""))cancelled=true;
        else throw error;
      }
      const kind=route[1].toUpperCase();
      await pool.query(`INSERT INTO documents(empresa_id,kind,chave,status,xml_data,source,file_name,created_by)
        SELECT $1,$2,$3::text,$4,$5,'sefaz-consulta',$6,$7
        WHERE NOT EXISTS(SELECT 1 FROM documents WHERE chave=$3::text AND empresa_id IS NOT DISTINCT FROM $1)`,
        [user.empresa_ativa_id,kind,route[2],cancelled?"cancelado":"importado",xml,
          cancelled?null:`${route[2]}.xml`,user.id]);
      return response.json({
        ok: true,
        status: cancelled
          ?"NF-e cancelada. A SEFAZ não disponibiliza mais o XML (cStat 653)."
          :"Documento localizado na Distribuição DF-e",
        provider: "sefaz",
        chave: route[2],
        xml,
        cancelled,
      });
    }

    if (route[0] === "docs" && request.method === "GET") {
      if (route.length === 1) {
        const page=Math.max(1,Number(request.query.page)||1);
        const limit=Math.min(100,Math.max(10,Number(request.query.limit)||25));
        const offset=(page-1)*limit;
        const q=String(request.query.q||"").trim();
        const kind=String(request.query.kind||"").toUpperCase();
        const status=String(request.query.status||"");
        const filters=`($2='' OR d.kind=$2) AND ($3='' OR d.status=$3) AND
          ($4='' OR d.chave ILIKE $5 OR d.numero ILIKE $5 OR d.remetente_nome ILIKE $5 OR
           d.destinatario_nome ILIKE $5)`;
        const values=[user.empresa_ativa_id,kind,status,q,`%${q}%`];
        const [result,count]=await Promise.all([pool.query(
          `SELECT d.*,COALESCE(u.nome,u.username) AS created_by_name FROM documents d
            LEFT JOIN users u ON u.id=d.created_by
            WHERE ($1::bigint IS NULL OR d.empresa_id=$1)
              AND ${filters}
            ORDER BY d.created_at DESC NULLS LAST,d.id DESC LIMIT $6 OFFSET $7`,
          [...values,limit,offset],
        ),pool.query(`SELECT COUNT(*)::int total FROM documents d
          WHERE ($1::bigint IS NULL OR d.empresa_id=$1) AND ${filters}`,values)]);
        return response.json({items:result.rows,total:count.rows[0].total,page,limit,
          pages:Math.max(1,Math.ceil(count.rows[0].total/limit))});
      }
      const result = await pool.query(
        "SELECT * FROM documents WHERE id=$1 AND ($2::bigint IS NULL OR empresa_id=$2)",
        [Number(route[1]),user.empresa_ativa_id],
      );
      if (!result.rowCount) return response.status(404).json({ error: "Documento não encontrado" });
      if (route[2] === "xml") {
        if (!result.rows[0].xml_data)
          return response.status(404).json({ error: "XML não armazenado" });
        response.setHeader("Content-Type", "application/xml; charset=utf-8");
        response.setHeader("Content-Disposition", `attachment; filename="${result.rows[0].chave || result.rows[0].id}.xml"`);
        return response.send(result.rows[0].xml_data);
      }
      if (route[2] === "pdf")
        return response.status(501).json({ error: "PDF auxiliar ainda não disponível para este documento." });
      return response.json(result.rows[0]);
    }

    if (route[0] === "sefaz" || route[0] === "meudanfe" || route[0] === "consulta")
      return response.status(503).json({
        error: "Integração indisponível no ambiente serverless; somente consulta será habilitada após configurar o provedor.",
      });

    if (route[0] === "sefaz-monitor")
      return response.json({ online: 0, offline: 0, ufs: [], checkedAt: new Date().toISOString() });

    if (route[0] === "relatorio") {
      const result = await pool.query(
        `SELECT kind,chave,numero,data_emissao,valor_total,status,remetente_nome,destinatario_nome,xml_data
           FROM documents WHERE ($1::bigint IS NULL OR empresa_id=$1)
           ORDER BY data_emissao DESC NULLS LAST`,
        [user.empresa_ativa_id],
      );
      const xmlValue=(xml,name)=>String(xml||"").match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)<\\/${name}>`,"i"))?.[1]?.trim()||"";
      const reportRows=result.rows.map(row=>({
        tipo:row.kind,chave:row.chave,numero:row.numero,serie:xmlValue(row.xml_data,"serie"),
        emissao:row.data_emissao,valor_total:row.valor_total,status:row.status,
        emitente:row.remetente_nome||xmlValue(row.xml_data,"xNome"),
        emitente_cnpj:xmlValue(row.xml_data,"CNPJ"),emitente_ie:xmlValue(row.xml_data,"IE"),
        destinatario:row.destinatario_nome,destinatario_documento:xmlValue(row.xml_data,"CPF"),
        natureza_operacao:xmlValue(row.xml_data,"natOp"),cfop:xmlValue(row.xml_data,"CFOP"),
        uf_origem:xmlValue(row.xml_data,"UFIni"),uf_destino:xmlValue(row.xml_data,"UFFim"),
        protocolo:xmlValue(row.xml_data,"nProt"),valor_produtos:xmlValue(row.xml_data,"vProd"),
        valor_frete:xmlValue(row.xml_data,"vFrete"),valor_desconto:xmlValue(row.xml_data,"vDesc"),
        base_icms:xmlValue(row.xml_data,"vBC"),valor_icms:xmlValue(row.xml_data,"vICMS"),
        valor_ipi:xmlValue(row.xml_data,"vIPI"),valor_pis:xmlValue(row.xml_data,"vPIS"),
        valor_cofins:xmlValue(row.xml_data,"vCOFINS"),arquivo:row.file_name||`${row.chave||row.id}.xml`,
      }));
      const reportColumns=Object.keys(reportRows[0]||{
        tipo:"",chave:"",numero:"",serie:"",emissao:"",valor_total:"",status:"",emitente:"",
        emitente_cnpj:"",emitente_ie:"",destinatario:"",destinatario_documento:"",natureza_operacao:"",
        cfop:"",uf_origem:"",uf_destino:"",protocolo:"",valor_produtos:"",valor_frete:"",
        valor_desconto:"",base_icms:"",valor_icms:"",valor_ipi:"",valor_pis:"",valor_cofins:"",arquivo:"",
      });
      if (route[1] === "csv") {
        const escape = (value) => `"${String(value ?? "").replaceAll('"','""')}"`;
        const csv = [reportColumns.join(";"), ...reportRows.map((row) => reportColumns.map((key) => escape(row[key])).join(";"))].join("\r\n");
        response.setHeader("Content-Type", "text/csv; charset=utf-8");
        response.setHeader("Content-Disposition", "attachment; filename=relatorio-fiscal.csv");
        return response.send(`\uFEFF${csv}`);
      }
      if(route[1]==="xlsx"){
        const {gerarXlsx,headerRow,dataRow}=await import("../backend/xlsx-writer.js");
        const labels=reportColumns.map(key=>key.replaceAll("_"," ").replace(/\b\w/g,char=>char.toUpperCase()));
        const rows=[headerRow(labels),...reportRows.map(row=>dataRow(reportColumns.map(key=>row[key])))];
        const buffer=gerarXlsx([{name:"Documentos destrinchados",rows,freezeHeader:true,
          colWidths:reportColumns.map(key=>key==="chave"?48:key.includes("nome")||["emitente","destinatario"].includes(key)?32:18)}]);
        response.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition",'attachment; filename="relatorio-fiscal.xlsx"');
        return response.send(buffer);
      }
      if(route[1]==="lote"){
        const {ZipWriter}=await import("../backend/zip-writer.js"); const zip=new ZipWriter();
        let total=0;
        for(const row of result.rows)if(row.xml_data){zip.addFile(`${row.kind||"DOC"}/${row.chave||row.numero||total}.xml`,row.xml_data);total++}
        if(!total)return response.status(404).json({error:"Nenhum XML armazenado para esta empresa"});
        response.setHeader("Content-Type","application/zip");
        response.setHeader("Content-Disposition",'attachment; filename="documentos-xml.zip"');
        return response.send(zip.toBuffer());
      }
      return response.json({ items: result.rows, total: result.rowCount });
    }

    return response.status(404).json({ error: "Endpoint ainda não migrado" });
  } catch (error) {
    console.error("api error", error);
    if(/cStat 656|Consumo Indevido/i.test(error.message||""))
      return response.status(429).json({error:"A SEFAZ bloqueou temporariamente consultas repetidas por NSU. Aguarde 1 hora e continue a partir do último NSU."});
    if(/cStat 653|NF-e Cancelada/i.test(error.message||""))
      return response.status(409).json({error:"NF-e cancelada: a SEFAZ não disponibiliza mais o XML para download (cStat 653)."});
    return response.status(error.code === "23505" ? 400 : 500).json({
      error: error.code === "23505" ? "Registro já cadastrado" : "Erro interno da API",
    });
  }
}
