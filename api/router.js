import crypto from "node:crypto";
import { ensureSchema, pool } from "./_database.js";
import {getCompanyCertificate} from "./_company-certificate.js";

const RELEASE={
  version:"2026.07.26.5",
  title:"A Haixel chegou com uma experiência fiscal renovada",
  publishedAt:"2026-07-26T20:00:00-03:00",
  summary:"Nova identidade, navegação guiada e melhorias importantes de segurança, estabilidade e gestão documental.",
  items:[
    {type:"new",title:"Nova identidade Haixel",text:"Nome, logo e experiência visual renovados em toda a plataforma."},
    {type:"new",title:"Hub SEFAZ centralizado",text:"Certificado A1, política preventiva, fila, último NSU e diagnóstico agora ficam no mesmo centro de controle."},
    {type:"new",title:"Documentos emitidos e recebidos",text:"Nova separação entre documentos emitidos pela empresa e documentos emitidos contra o CNPJ ativo."},
    {type:"improved",title:"Proteção contra Consumo Indevido",text:"Fila exclusiva, NSU sequencial, pausas para cStat 137/656 e limite conservador de chaves por hora."},
    {type:"fixed",title:"Leitura de certidões em PDF",text:"Corrigido o empacotamento do leitor serverless e do worker usado na extração de texto."},
    {type:"fixed",title:"Foto de perfil",text:"Corrigida a alteração e remoção da imagem do usuário."},
  ],
};

function parts(request) {
  const value = request.query.route;
  return Array.isArray(value) ? value : String(value || "").split("/").filter(Boolean);
}
function token(request) {
  const match = String(request.headers.cookie || "").match(/(?:^|;\s*)sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
function fiscalSummary(xml){
  const source=String(xml||"");
  const first=(name,scope=source)=>scope.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)<\\/${name}>`,"i"))?.[1]?.trim()||null;
  const block=(name)=>source.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1]||"";
  const emit=block("emit"),dest=block("dest"),isCte=/<(?:CTe|cteProc|infCte)\b/i.test(source);
  return {
    numero:first(isCte?"nCT":"nNF"),
    serie:first("serie"),
    dataEmissao:first("dhEmi")||first("dEmi"),
    valor:Number(first(isCte?"vTPrest":"vNF")||0),
    emitente:first("xNome",emit),
    emitenteDoc:first("CNPJ",emit)||first("CPF",emit),
    destinatario:first("xNome",dest),
    destinatarioDoc:first("CNPJ",dest)||first("CPF",dest),
    protocolo:first("nProt"),
  };
}
function sourceInfoServer(value){
  const key=String(value||"system").toLowerCase();
  if(key==="upload")return "Importação manual";
  if(key==="paste")return "Inclusão manual";
  if(key.includes("mtls-auto"))return "SEFAZ automática";
  if(key.includes("sefaz"))return "Consulta SEFAZ por chave";
  return "Sistema";
}
async function authenticated(request) {
  const sid = token(request);
  if (!sid) return null;
  const result = await pool.query(
    `SELECT u.*,s.empresa_ativa_id,s.auth_method FROM sessions s JOIN users u ON u.id=s.user_id
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
    const route = parts(request);
    if(route[0]==="system"&&request.method==="GET"){
      const configured=String(process.env.MAINTENANCE_MODE??"true");
      const active=!/^(0|false|no)$/i.test(configured);
      return response.json({release:RELEASE,maintenance:{
        active,
        title:process.env.MAINTENANCE_TITLE||"A Haixel está ficando ainda melhor",
        message:process.env.MAINTENANCE_MESSAGE||"Estamos implementando e validando novas funcionalidades com todo cuidado. O acesso será liberado assim que a atualização estiver concluída.",
        startsAt:process.env.MAINTENANCE_START||null,
        endsAt:process.env.MAINTENANCE_END||null,
      }});
    }
    if(route[0]==="health"&&request.method==="GET"){
      try{
        await pool.query("SELECT 1");
        return response.json({ok:true,database:true,time:new Date().toISOString()});
      }catch{
        return response.status(503).json({ok:false,database:false,error:"Falha ao conectar ao banco"});
      }
    }
    await ensureSchema();

    if (route[0] === "news" && request.method === "GET")
      return response.json({ externos: [], curadas: [
        {id:"reforma",tagLabel:"REFORMA TRIBUTÁRIA",titulo:"Acompanhe a regulamentação da Reforma Tributária",
          resumo:"Atualizações oficiais, legislação e orientações publicadas pelo Governo Federal.",
          fonte:"Ministério da Fazenda",url:"https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria",data:new Date().toISOString()},
        {id:"receita",tagLabel:"RECEITA FEDERAL",titulo:"Normas e orientações tributárias",
          resumo:"Comunicados, serviços e mudanças que afetam empresas e profissionais contábeis.",
          fonte:"Receita Federal",url:"https://www.gov.br/receitafederal/pt-br",data:new Date().toISOString()},
        {id:"sped",tagLabel:"SPED",titulo:"Escrituração e documentos digitais",
          resumo:"Publicações técnicas, tabelas, manuais e atualizações dos projetos SPED.",
          fonte:"Portal SPED",url:"http://sped.rfb.gov.br/",data:new Date().toISOString()},
        {id:"confaz",tagLabel:"ICMS",titulo:"Convênios, ajustes SINIEF e atos COTEPE",
          resumo:"Acompanhe normas nacionais relacionadas ao ICMS e documentos fiscais eletrônicos.",
          fonte:"CONFAZ",url:"https://www.confaz.fazenda.gov.br/",data:new Date().toISOString()},
      ] });

    const user = await authenticated(request);
    if (!user) return response.status(401).json({ error: "Não autenticado" });
    const activeEmpresaId=Number(request.headers["x-empresa-id"]||user.empresa_ativa_id||0);

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
      if(route[1]==="batch-delete"&&request.method==="POST"){
        const ids=[...new Set((request.body?.ids||[]).map(Number).filter(Number.isSafeInteger))];
        if(!ids.length)return response.status(400).json({error:"Selecione ao menos uma certidão"});
        const empresaId=Number(request.headers["x-empresa-id"]||user.empresa_ativa_id)||null;
        const deleted=await pool.query(`DELETE FROM certidoes WHERE id=ANY($1::bigint[])
          AND ($2::bigint IS NULL OR empresa_id=$2) RETURNING id`,[ids,empresaId]);
        return response.json({ok:true,deleted:deleted.rowCount});
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
        const empresaId=Number(request.headers["x-empresa-id"]||user.empresa_ativa_id)||null;
        const deleted=await pool.query(`DELETE FROM certidoes WHERE id=$1
          AND ($2::bigint IS NULL OR empresa_id=$2) RETURNING id`, [certidaoId,empresaId]);
        if(!deleted.rowCount)return response.status(404).json({error:"Certidão não encontrada nesta empresa"});
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
      const certificate=activeEmpresaId?await pool.query(`SELECT arquivo_nome,titular,cnpj,validade_fim
        FROM empresa_certificados WHERE empresa_id=$1`,[activeEmpresaId]):{rows:[],rowCount:0};
      const configured = Boolean(certificate.rowCount||process.env.SEFAZ_PFX_BASE64);
      return response.json({
        certificados: configured
          ? [{
              thumbprint: certificate.rowCount?"empresa-db":"vercel-secret",
              label: certificate.rows[0]?.arquivo_nome||"Certificado A1 configurado",
              subject: certificate.rows[0]?.titular||`CNPJ ${process.env.SEFAZ_CNPJ || ""}`,
              issuer: certificate.rowCount?"Cofre criptografado da empresa":"Certificado protegido na Vercel",
              validade_fim:certificate.rows[0]?.validade_fim||null,
            }]
          : [],
      });
    }
    if(route[0]==="sefaz"&&route[1]==="sync-state"&&request.method==="GET"){
      if(!activeEmpresaId)return response.status(400).json({error:"Selecione uma empresa"});
      const state=await pool.query(`SELECT ult_nsu,max_nsu,locked_until,last_status,last_error,updated_at
        FROM sefaz_sync_state WHERE empresa_id=$1`,[activeEmpresaId]);
      const usage=await pool.query(`SELECT COUNT(*)::int used FROM sefaz_key_query_log
        WHERE empresa_id=$1 AND created_at>NOW()-INTERVAL '1 hour'`,[activeEmpresaId]);
      return response.json({state:state.rows[0]||{ult_nsu:"0",max_nsu:"0",last_status:"ainda_não_iniciado"},
        individualQueriesLastHour:Number(usage.rows[0]?.used||0),safeLimit:18,
        protections:{sequentialNsu:true,exclusiveQueue:true,cooldown137Minutes:60,
          cooldown656Minutes:60,individualLimitPerHour:18,officialLimitPerHour:20}});
    }

    if (
      route[0] === "sefaz" &&
      route[1] === "cert" &&
      route[2] === "periodo-auto" &&
      request.method === "POST"
    ) {
      if(!["certificate","mtls"].includes(String(user.auth_method||"")))
        return response.status(403).json({error:"Valide o certificado digital instalado na configuração da empresa antes de buscar na SEFAZ"});
      if(!activeEmpresaId)
        return response.status(400).json({error:"Selecione uma empresa antes de buscar documentos na SEFAZ"});
      const credentials=await getCompanyCertificate(activeEmpresaId);
      if(!credentials)return response.status(503).json({error:"Anexe o certificado A1 na configuração da empresa"});
      const { consultarPeriodoComCertificado } = await import(
        "../backend/services/sefaz-distribuicao.js"
      );
      await pool.query(`INSERT INTO sefaz_sync_state(empresa_id) VALUES($1)
        ON CONFLICT(empresa_id) DO NOTHING`,[activeEmpresaId]);
      const claim=await pool.query(`UPDATE sefaz_sync_state SET locked_until=NOW()+INTERVAL '5 minutes',
        last_status='processando',updated_at=NOW() WHERE empresa_id=$1
        AND (locked_until IS NULL OR locked_until<=NOW()) RETURNING ult_nsu`,[activeEmpresaId]);
      if(!claim.rowCount){
        const state=await pool.query("SELECT ult_nsu,locked_until,last_status FROM sefaz_sync_state WHERE empresa_id=$1",[activeEmpresaId]);
        return response.status(429).json({error:"Sincronização SEFAZ em espera. O sistema retomará automaticamente sem reiniciar o NSU.",
          state:state.rows[0]});
      }
      const moduleConfig=await pool.query(`SELECT configuracao FROM empresa_module_config
        WHERE empresa_id=$1 AND modulo='sefaz' AND ativo=TRUE`,[activeEmpresaId]);
      const sefazConfig=moduleConfig.rows[0]?.configuracao||{};
      const requestedBatch=Math.min(50,Math.max(1,Number(sefazConfig.lote_maximo)||50));
      let result;
      try{result = await consultarPeriodoComCertificado({
        pfx: credentials.pfx,
        passphrase: credentials.passphrase,
        uf: process.env.SEFAZ_UF || "MG",
        ambiente: "producao",
        cnpjOuCpf: credentials.cnpj||process.env.SEFAZ_CNPJ,
        ultNSUInicial: claim.rows[0].ult_nsu || "0",
        dateFrom: request.body?.dateFrom,
        dateTo: request.body?.dateTo,
        maxIteracoes: Math.max(1,Math.ceil(requestedBatch/50)),
      });}catch(error){
        const blocked=/cStat 656|Consumo Indevido/i.test(error.message||"");
        await pool.query(`UPDATE sefaz_sync_state SET locked_until=NOW()+($2::int*INTERVAL '1 minute'),
          last_status=$3,last_error=$4,updated_at=NOW() WHERE empresa_id=$1`,
          [activeEmpresaId,blocked?60:5,blocked?"bloqueado_656":"erro",String(error.message||error).slice(0,1000)]);
        throw error;
      }
      let saved=0;
      for(const doc of result.docs){
        if(doc.xml.includes("<resNFe")||doc.xml.includes("<resEvento")) continue;
        const match=doc.xml.match(/<chNFe>([^<]+)<\/chNFe>/)||doc.xml.match(/<chCTe>([^<]+)<\/chCTe>/)||doc.xml.match(/Id="[A-Za-z]*(\d{44})"/);
        const chave=match?.[1]; if(!chave) continue;
        const kind=doc.xml.includes("<CTe")||doc.xml.includes("<cteProc")?"CTE":"NFE";
        const inserted=await pool.query(`INSERT INTO documents(empresa_id,kind,chave,status,xml_data,source,file_name,created_by)
          SELECT $1,$2,$3::text,'importado',$4,'sefaz-mtls-auto',$5,$6
          WHERE NOT EXISTS(SELECT 1 FROM documents WHERE chave=$3::text AND empresa_id IS NOT DISTINCT FROM $1)`,
          [activeEmpresaId,kind,chave,doc.xml,`${chave}.xml`,user.id]);
        const summary=fiscalSummary(doc.xml);
        await pool.query(`UPDATE documents SET numero=COALESCE($3,numero),serie=COALESCE($4,serie),data_emissao=COALESCE($5,data_emissao),
          valor_total=COALESCE($6,valor_total),remetente_nome=COALESCE($7,remetente_nome),
          remetente_doc=COALESCE($8,remetente_doc),destinatario_nome=COALESCE($9,destinatario_nome),
          destinatario_doc=COALESCE($10,destinatario_doc),protocolo=COALESCE($11,protocolo),
          status='importado',xml_data=COALESCE($12,xml_data)
          WHERE empresa_id IS NOT DISTINCT FROM $1 AND chave=$2::text`,
          [activeEmpresaId,chave,summary.numero,summary.serie,summary.dataEmissao,summary.valor,
            summary.emitente,summary.emitenteDoc,summary.destinatario,summary.destinatarioDoc,summary.protocolo,doc.xml]);
        saved+=inserted.rowCount;
      }
      response.setHeader("X-Sefaz-Total", String(result.docs.length));
      response.setHeader("X-Sefaz-Salvos", String(saved));
      response.setHeader("X-Sefaz-UltNSU", String(result.ultNSU || ""));
      await pool.query(`UPDATE sefaz_sync_state SET ult_nsu=$2,max_nsu=$3,
        locked_until=CASE WHEN $4 THEN NOW()+INTERVAL '1 hour' ELSE NOW() END,
        last_status=$5,last_error=NULL,updated_at=NOW() WHERE empresa_id=$1`,
        [activeEmpresaId,String(result.ultNSU||"0"),String(result.maxNSU||"0"),
          Boolean(result.atingiuFim),result.atingiuFim?"aguardando_novos_documentos":"parcial"]);
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
      if(!["certificate","mtls"].includes(String(user.auth_method||"")))
        return response.status(403).json({error:"Valide o certificado digital instalado na configuração da empresa antes de consultar a SEFAZ"});
      if(!activeEmpresaId)
        return response.status(400).json({error:"Selecione uma empresa antes de consultar uma chave"});
      const credentials=await getCompanyCertificate(activeEmpresaId);
      if(!credentials)return response.status(503).json({error:"Anexe o certificado A1 na configuração da empresa"});
      const keyModuleConfig=await pool.query(`SELECT configuracao FROM empresa_module_config
        WHERE empresa_id=$1 AND modulo='sefaz' AND ativo=TRUE`,[activeEmpresaId]);
      const configuredLimit=Math.min(18,Math.max(1,Number(keyModuleConfig.rows[0]?.configuracao?.limite_chaves_hora)||18));
      const rateState=await pool.query(`SELECT COUNT(*)::int used,
        GREATEST(0,CEIL(EXTRACT(EPOCH FROM (MIN(created_at)+INTERVAL '1 hour'-NOW()))))::int retry_after
        FROM sefaz_key_query_log WHERE empresa_id=$1 AND created_at>NOW()-INTERVAL '1 hour'`,
        [activeEmpresaId]);
      if(Number(rateState.rows[0]?.used||0)>=configuredLimit){
        const retryAfter=Math.max(1,Number(rateState.rows[0]?.retry_after||3600));
        response.setHeader("Retry-After",String(retryAfter));
        return response.status(429).json({
          error:`Fila SEFAZ protegida: limite seguro de ${configuredLimit} consultas/hora atingido. Retomada em ${Math.ceil(retryAfter/60)} minuto(s).`,
          code:"SEFAZ_SAFE_RATE_LIMIT",retryAfter,
        });
      }
      await pool.query("INSERT INTO sefaz_key_query_log(empresa_id,chave) VALUES($1,$2)",
        [activeEmpresaId,route[2]]);
      const { consultarChaveComCertificado } = await import(
        "../backend/services/sefaz-distribuicao.js"
      );
      let xml=null,cancelled=false;
      try{
        xml = await consultarChaveComCertificado({
          pfx: credentials.pfx,
          passphrase: credentials.passphrase,
          uf: process.env.SEFAZ_UF || "MG",
          ambiente: "producao",
          cnpjOuCpf: credentials.cnpj||process.env.SEFAZ_CNPJ,
          chave: route[2],
        });
      }catch(error){
        if(/cStat 653|NF-e Cancelada/i.test(error.message||""))cancelled=true;
        else throw error;
      }
      const kind=route[1].toUpperCase();
      const summary=fiscalSummary(xml);
      if(cancelled){
        const saved=await pool.query(`INSERT INTO documents(empresa_id,kind,chave,status,source,created_by)
          SELECT $1,$2,$3::text,'cancelado','sefaz-consulta',$4
          WHERE NOT EXISTS(SELECT 1 FROM documents WHERE chave=$3::text AND empresa_id IS NOT DISTINCT FROM $1)
          RETURNING id`,[activeEmpresaId,kind,route[2],user.id]);
        return response.json({ok:true,status:"Documento cancelado registrado sem XML (cStat 653).",
          provider:"sefaz",chave:route[2],xml:null,cancelled:true,imported:Boolean(saved.rowCount)});
      }
      const required={
        numero:summary.numero,serie:summary.serie,data_emissao:summary.dataEmissao,
        emitente:summary.emitente,emitente_documento:summary.emitenteDoc,
        destinatario:summary.destinatario,destinatario_documento:summary.destinatarioDoc,
        protocolo:summary.protocolo,
      };
      const missing=Object.entries(required).filter(([,value])=>value==null||String(value).trim()==="").map(([field])=>field);
      if(!xml||missing.length)return response.status(422).json({
        error:`XML incompleto; não importado. Campos ausentes: ${missing.join(", ")||"conteúdo XML"}.`,
        chave:route[2],imported:false,missing,logReason:"xml_incompleto",
      });
      await pool.query(`INSERT INTO documents(empresa_id,kind,chave,status,xml_data,source,file_name,created_by)
        SELECT $1,$2,$3::text,$4,$5,'sefaz-consulta',$6,$7
        WHERE NOT EXISTS(SELECT 1 FROM documents WHERE chave=$3::text AND empresa_id IS NOT DISTINCT FROM $1)`,
        [activeEmpresaId,kind,route[2],cancelled?"cancelado":"importado",xml,
          cancelled?null:`${route[2]}.xml`,user.id]);
      if(xml)await pool.query(`UPDATE documents SET numero=COALESCE($3,numero),serie=COALESCE($4,serie),data_emissao=COALESCE($5,data_emissao),
        valor_total=COALESCE($6,valor_total),remetente_nome=COALESCE($7,remetente_nome),
        remetente_doc=COALESCE($8,remetente_doc),destinatario_nome=COALESCE($9,destinatario_nome),
        destinatario_doc=COALESCE($10,destinatario_doc),protocolo=COALESCE($11,protocolo),
        status='importado',xml_data=COALESCE($12,xml_data)
        WHERE empresa_id IS NOT DISTINCT FROM $1 AND chave=$2::text`,
        [activeEmpresaId,route[2],summary.numero,summary.serie,summary.dataEmissao,summary.valor,
          summary.emitente,summary.emitenteDoc,summary.destinatario,summary.destinatarioDoc,summary.protocolo,xml]);
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

    if(route[0]==="docs"&&route[1]==="batch-delete"&&request.method==="POST"){
      const ids=[...new Set((request.body?.ids||[]).map(Number).filter(Number.isSafeInteger))];
      if(!ids.length)return response.status(400).json({error:"Selecione ao menos um documento"});
      const deleted=await pool.query(`DELETE FROM documents WHERE id=ANY($1::bigint[])
        AND ($2::bigint IS NULL OR empresa_id=$2) RETURNING id`,[ids,user.empresa_ativa_id]);
      return response.json({ok:true,deleted:deleted.rowCount});
    }
    if(route[0]==="docs"&&route[1]&&request.method==="DELETE"){
      const deleted=await pool.query(`DELETE FROM documents WHERE id=$1
        AND ($2::bigint IS NULL OR empresa_id=$2) RETURNING id`,[Number(route[1]),user.empresa_ativa_id]);
      if(!deleted.rowCount)return response.status(404).json({error:"Documento não encontrado"});
      return response.json({ok:true,deleted:1});
    }
    if (route[0] === "docs" && request.method === "GET") {
      if(route[1]==="issued"){
        const activeCompanyId=Number(request.headers["x-empresa-id"]||user.empresa_ativa_id||0);
        if(!activeCompanyId)return response.status(400).json({error:"Selecione uma empresa no topo do sistema"});
        const kind=String(request.query.kind||"").toUpperCase();
        const direction=String(request.query.direction||"outgoing")==="incoming"?"incoming":"outgoing";
        const month=/^\d{4}-\d{2}$/.test(String(request.query.month||""))?String(request.query.month):
          new Date().toISOString().slice(0,7);
        const company=await pool.query("SELECT regexp_replace(cnpj,'\\D','','g') cnpj,nome FROM empresas WHERE id=$1 AND ativo=TRUE",
          [activeCompanyId]);
        if(!company.rowCount)return response.status(404).json({error:"Empresa ativa não encontrada"});
        const result=await pool.query(`SELECT d.id,d.kind,d.chave,d.numero,d.serie,d.data_emissao,d.valor_total,
          d.status,d.destinatario_nome,d.destinatario_doc,d.source,d.created_at,(d.xml_data IS NOT NULL) has_xml
          FROM documents d WHERE d.empresa_id=$1
          AND (($5='outgoing' AND regexp_replace(COALESCE(d.remetente_doc,''),'\\D','','g')=$3)
            OR ($5='incoming' AND regexp_replace(COALESCE(d.destinatario_doc,''),'\\D','','g')=$3))
          AND ($2='' OR d.kind=$2)
          AND COALESCE(d.data_emissao,d.created_at)::date>=($4||'-01')::date
          AND COALESCE(d.data_emissao,d.created_at)::date<(($4||'-01')::date+INTERVAL '1 month')
          ORDER BY d.data_emissao DESC NULLS LAST,d.created_at DESC LIMIT 10000`,
          [activeCompanyId,kind,company.rows[0].cnpj,month,direction]);
        const stats=result.rows.reduce((summary,row)=>{
          summary.total++;const key=String(row.kind||"").toLowerCase();
          if(Object.hasOwn(summary,key))summary[key]++;return summary;
        },{total:0,nfe:0,nfse:0,cte:0});
        return response.json({items:result.rows,stats,company:company.rows[0],month,direction,
          connectors:{nfe:"nsu_protegido",cte:"aguardando_configuracao",nfse:"aguardando_provedor"}});
      }
      if(route[1]==="import-log"){
        const result=await pool.query(`SELECT d.id,d.kind,d.chave,d.numero,d.status,d.source,d.file_name,d.created_at,
          COALESCE(u.nome,u.username,'Sistema / SEFAZ') created_by_name
          FROM documents d LEFT JOIN users u ON u.id=d.created_by
          WHERE ($1::bigint IS NULL OR d.empresa_id=$1)
          ORDER BY d.created_at DESC NULLS LAST,d.id DESC LIMIT 1000`,[user.empresa_ativa_id]);
        return response.json({items:result.rows,total:result.rowCount});
      }
      if (route.length === 1) {
        const page=Math.max(1,Number(request.query.page)||1);
        const limit=Math.min(100,Math.max(10,Number(request.query.limit)||25));
        const offset=(page-1)*limit;
        const q=String(request.query.q||"").trim();
        const kind=String(request.query.kind||"").toUpperCase();
        const status=String(request.query.status||"");
        const values=[user.empresa_ativa_id,kind,status,q,`%${q}%`];
        const extra=[];
        const addLike=(column,value)=>{if(value){values.push(`%${String(value).trim()}%`);extra.push(`${column} ILIKE $${values.length}`)}};
        addLike("d.remetente_doc",request.query.emitenteCnpj);
        addLike("d.remetente_nome",request.query.emitenteRazaoSocial||request.query.emitenteNomeFantasia);
        addLike("d.destinatario_nome",request.query.destinatarioNome);
        addLike("d.chave",request.query.chaveAcesso);
        if(request.query.cancelados==="1"){values.push("cancelado");extra.push(`LOWER(d.status)=$${values.length}`)}
        if(request.query.cancelados==="0")extra.push(`LOWER(COALESCE(d.status,''))<>'cancelado'`);
        if(request.query.dataRegistroFrom){values.push(request.query.dataRegistroFrom);extra.push(`d.created_at>=$${values.length}::date`)}
        if(request.query.dataRegistroTo){values.push(request.query.dataRegistroTo);extra.push(`d.created_at<$${values.length}::date+INTERVAL '1 day'`)}
        const filters=`($2='' OR d.kind=$2) AND ($3='' OR d.status=$3) AND
          ($4='' OR d.chave ILIKE $5 OR d.numero ILIKE $5 OR d.remetente_nome ILIKE $5 OR
           d.remetente_doc ILIKE $5 OR d.destinatario_doc ILIKE $5 OR d.destinatario_nome ILIKE $5)
           ${extra.length?`AND ${extra.join(" AND ")}`:""}`;
        const [result,count]=await Promise.all([pool.query(
          `SELECT d.*,COALESCE(u.nome,u.username) AS created_by_name FROM documents d
            LEFT JOIN users u ON u.id=d.created_by
            WHERE ($1::bigint IS NULL OR d.empresa_id=$1)
              AND ${filters}
            ORDER BY d.created_at DESC NULLS LAST,d.id DESC LIMIT $${values.length+1} OFFSET $${values.length+2}`,
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

    if (route[0] === "sefaz-monitor") {
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
      try{
        const monitorResponse=await fetch("https://monitorsefaz.webmaniabr.com/v3/components.json",{
          signal:controller.signal,headers:{"User-Agent":"CordeiroFiscalMonitor/2.0"},
        });
        if(!monitorResponse.ok)throw new Error(`HTTP ${monitorResponse.status}`);
        const monitor=await monitorResponse.json();
        const ufs=(monitor.components||[]).filter(component=>component.group).map(component=>{
          const status=String(component.status||"").toUpperCase();
          const operational=status==="OPERATIONAL",degraded=["DEGRADED","UNDER_MAINTENANCE"].includes(status);
          return {uf:component.name,env:component.group?.name||"SEFAZ",ok:operational||degraded,
            error:degraded?"timeout":operational?null:"offline",status:operational?200:degraded?206:503,
            description:component.description||null};
        });
        const online=ufs.filter(item=>item.ok).length;
        return response.json({checkedAt:new Date().toISOString(),total:ufs.length,online,offline:ufs.length-online,
          latencyAvg:null,source:"webmaniabr",stale:false,ufs});
      }catch(error){
        return response.status(502).json({error:`Falha ao consultar o monitor SEFAZ: ${error.message}`});
      }finally{clearTimeout(timer)}
    }

    if (route[0] === "relatorio") {
      const reportMonth=/^\d{4}-\d{2}$/.test(String(request.query.month||""))?String(request.query.month):"";
      const reportCompanyId=Number(request.headers["x-empresa-id"]||user.empresa_ativa_id)||null;
      const result = await pool.query(
        `SELECT d.kind,d.chave,d.numero,d.data_emissao,d.valor_total,d.status,d.remetente_nome,d.destinatario_nome,
           d.xml_data,d.source,d.file_name,d.created_at,COALESCE(u.nome,u.username,'Sistema / SEFAZ') created_by_name
           FROM documents d LEFT JOIN users u ON u.id=d.created_by
           WHERE ($1::bigint IS NULL OR d.empresa_id=$1)
             AND ($2='' OR (COALESCE(d.data_emissao,d.created_at)::date>=($2||'-01')::date
               AND COALESCE(d.data_emissao,d.created_at)::date<(($2||'-01')::date+INTERVAL '1 month')))
           ORDER BY d.created_at DESC NULLS LAST`,
        [reportCompanyId,reportMonth],
      );
      const xmlValue=(xml,name)=>String(xml||"").match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)<\\/${name}>`,"i"))?.[1]?.trim()||"";
      const xmlBlock=(xml,name)=>String(xml||"").match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1]||"";
      let reportRows=result.rows.flatMap(row=>{
        const xml=String(row.xml_data||""),emit=xmlBlock(xml,"emit"),dest=xmlBlock(xml,"dest");
        const base={
        tipo:row.kind,chave:row.chave,numero_nota:row.numero||xmlValue(xml,"nNF")||xmlValue(xml,"nCT"),
        serie:xmlValue(xml,"serie"),emissao:row.data_emissao||xmlValue(xml,"dhEmi")||xmlValue(xml,"dEmi"),
        valor_total:row.valor_total,status:row.status,
        emitente:row.remetente_nome||xmlValue(emit,"xNome"),emitente_fantasia:xmlValue(emit,"xFant"),
        emitente_cnpj:xmlValue(emit,"CNPJ")||xmlValue(emit,"CPF"),emitente_ie:xmlValue(emit,"IE"),
        destinatario:row.destinatario_nome||xmlValue(dest,"xNome"),
        destinatario_documento:xmlValue(dest,"CNPJ")||xmlValue(dest,"CPF"),
        natureza_operacao:xmlValue(xml,"natOp"),uf_origem:xmlValue(xml,"UFIni"),uf_destino:xmlValue(xml,"UFFim"),
        protocolo:xmlValue(xml,"nProt"),valor_produtos:xmlValue(xmlBlock(xml,"ICMSTot"),"vProd"),
        valor_frete:xmlValue(xmlBlock(xml,"ICMSTot"),"vFrete"),valor_desconto:xmlValue(xmlBlock(xml,"ICMSTot"),"vDesc"),
        base_icms:xmlValue(xmlBlock(xml,"ICMSTot"),"vBC"),valor_icms:xmlValue(xmlBlock(xml,"ICMSTot"),"vICMS"),
        valor_ipi:xmlValue(xmlBlock(xml,"ICMSTot"),"vIPI"),valor_pis:xmlValue(xmlBlock(xml,"ICMSTot"),"vPIS"),
        valor_cofins:xmlValue(xmlBlock(xml,"ICMSTot"),"vCOFINS"),origem:sourceInfoServer(row.source),
        codigo_servico:xmlValue(xml,"cTribNac")||xmlValue(xml,"ItemListaServico")||xmlValue(xml,"CodigoTributacaoMunicipio"),
        descricao_servico:xmlValue(xml,"xDescServ")||xmlValue(xml,"Discriminacao"),
        municipio_prestacao:xmlValue(xml,"cLocPrestacao")||xmlValue(xml,"CodigoMunicipio"),
        valor_servico:xmlValue(xml,"vServ")||xmlValue(xml,"ValorServicos"),
        aliquota_iss:xmlValue(xml,"pAliq")||xmlValue(xml,"Aliquota"),
        valor_iss:xmlValue(xml,"vISSQN")||xmlValue(xml,"ValorIss"),
        iss_retido:xmlValue(xml,"ISSRetido")||xmlValue(xml,"tpRetISSQN"),
        valor_deducoes:xmlValue(xml,"ValorDeducoes"),base_calculo_servico:xmlValue(xml,"BaseCalculo"),
        valor_inss:xmlValue(xml,"ValorInss"),valor_ir:xmlValue(xml,"ValorIr"),
        valor_csll:xmlValue(xml,"ValorCsll"),valor_cbs:xmlValue(xml,"vCBS"),
        valor_ibs_uf:xmlValue(xml,"vIBSUF"),valor_ibs_municipal:xmlValue(xml,"vIBSMun"),
        incluido_por:row.created_by_name,incluido_em:row.created_at,
        arquivo:row.file_name||`${row.chave||"documento"}.xml`,
        };
        const details=[...xml.matchAll(/<det\b([^>]*)>([\s\S]*?)<\/det>/gi)];
        if(!details.length)return [{...base,item_numero:"",produto_codigo:"",produto_descricao:"",
          ncm:"",cest:"",cfop:xmlValue(xml,"CFOP"),unidade:"",quantidade:"",valor_unitario:"",
          valor_produto:"",ean:"",origem_mercadoria:"",cst_csosn:"",base_icms_item:"",
          aliquota_icms:"",icms_item:"",ipi_item:"",pis_item:"",cofins_item:""}];
        return details.map((match,index)=>{
          const item=match[2],prod=xmlBlock(item,"prod"),imposto=xmlBlock(item,"imposto");
          return {...base,item_numero:match[1].match(/\bnItem=["']([^"']+)/i)?.[1]||String(index+1),
            produto_codigo:xmlValue(prod,"cProd"),produto_descricao:xmlValue(prod,"xProd"),
            ncm:xmlValue(prod,"NCM"),cest:xmlValue(prod,"CEST"),cfop:xmlValue(prod,"CFOP"),
            unidade:xmlValue(prod,"uCom"),quantidade:xmlValue(prod,"qCom"),
            valor_unitario:xmlValue(prod,"vUnCom"),valor_produto:xmlValue(prod,"vProd"),
            ean:xmlValue(prod,"cEAN"),origem_mercadoria:xmlValue(imposto,"orig"),
            cst_csosn:xmlValue(imposto,"CST")||xmlValue(imposto,"CSOSN"),
            base_icms_item:xmlValue(imposto,"vBC"),aliquota_icms:xmlValue(imposto,"pICMS"),
            icms_item:xmlValue(imposto,"vICMS"),ipi_item:xmlValue(imposto,"vIPI"),
            pis_item:xmlValue(imposto,"vPIS"),cofins_item:xmlValue(imposto,"vCOFINS")};
        });
      });
      const model=String(request.query.modelo||"completo").toLowerCase();
      if(model==="nfe")reportRows=reportRows.filter(row=>row.tipo==="NFE");
      if(model==="nfse")reportRows=reportRows.filter(row=>row.tipo==="NFSE");
      if(model==="cte")reportRows=reportRows.filter(row=>row.tipo==="CTE");
      if(model==="cancelados")reportRows=reportRows.filter(row=>String(row.status).toLowerCase()==="cancelado");
      if(model==="manual")reportRows=reportRows.filter(row=>/manual/i.test(row.origem));
      if(model==="sefaz")reportRows=reportRows.filter(row=>/sefaz/i.test(row.origem));
      const reportColumns=Object.keys(reportRows[0]||{
        tipo:"",chave:"",numero_nota:"",serie:"",emissao:"",valor_total:"",status:"",emitente:"",
        emitente_fantasia:"",emitente_cnpj:"",emitente_ie:"",destinatario:"",destinatario_documento:"",natureza_operacao:"",
        uf_origem:"",uf_destino:"",protocolo:"",valor_produtos:"",valor_frete:"",
        valor_desconto:"",base_icms:"",valor_icms:"",valor_ipi:"",valor_pis:"",valor_cofins:"",
        origem:"",incluido_por:"",incluido_em:"",arquivo:"",item_numero:"",produto_codigo:"",
        produto_descricao:"",ncm:"",cest:"",cfop:"",unidade:"",quantidade:"",valor_unitario:"",
        valor_produto:"",ean:"",origem_mercadoria:"",cst_csosn:"",base_icms_item:"",
        aliquota_icms:"",icms_item:"",ipi_item:"",pis_item:"",cofins_item:"",
        codigo_servico:"",descricao_servico:"",municipio_prestacao:"",valor_servico:"",
        aliquota_iss:"",valor_iss:"",iss_retido:"",valor_deducoes:"",base_calculo_servico:"",
        valor_inss:"",valor_ir:"",valor_csll:"",valor_cbs:"",valor_ibs_uf:"",valor_ibs_municipal:"",
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
