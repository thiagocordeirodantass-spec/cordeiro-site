import fs from "node:fs/promises";
import formidable from "formidable";
import { ensureSchema, pool } from "../_database.js";

export const config = { api: { bodyParser: false } };

function first(xml, names) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return match[1].replace(/<[^>]+>/g, "").trim();
  }
  return null;
}

function summarize(xml, fileName) {
  const isCte = /<(?:cteProc|CTe|infCte)\b/i.test(xml);
  const isNfse=/<(?:NFSe|infNFSe|CompNfse|ListaNfse)\b/i.test(xml);
  const keyMatch = xml.match(/Id="(?:NFe|CTe|NFS[eE]?)(\d{44,50})"/i);
  const chave = keyMatch?.[1] || first(xml, ["chNFe", "chCTe","chNFSe","ChaveAcesso"]);
  return {
    kind: isCte ? "CTE" : isNfse?"NFSE":"NFE",
    chave: chave?.replace(/\D/g, "").slice(0, 50) || null,
    numero: first(xml, ["nCT", "nNF","nNFSe","Numero"]),
    dataEmissao: first(xml, ["dhEmi", "dEmi","dhProc","DataEmissao"]),
    valor: Number(first(xml, ["vNF", "vTPrest", "vRec","vServ","ValorServicos"]) || 0),
    status: /prot(?:NFe|CTe)/i.test(xml) ? "autorizado" : "importado",
    remetente: first(xml, ["xNome"]),
    fileName,
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST")
    return response.status(405).json({ error: "Método não permitido" });
  try {
    await ensureSchema();
    const sid = String(request.headers.cookie || "").match(/(?:^|;\s*)sid=([^;]+)/)?.[1];
    const session = sid
      ? await pool.query(
          `SELECT s.empresa_ativa_id,s.user_id,u.role,eu.permissoes FROM sessions s
           JOIN users u ON u.id=s.user_id LEFT JOIN empresa_users eu
             ON eu.user_id=s.user_id AND eu.empresa_id=s.empresa_ativa_id
           WHERE s.id=$1 AND s.expires_at>NOW()`,
          [decodeURIComponent(sid)],
        )
      : null;
    if (!session?.rowCount)
      return response.status(401).json({ error: "Não autenticado" });
    if(session.rows[0].role!=="admin"&&session.rows[0].permissoes?.documentos_incluir===false)
      return response.status(403).json({error:"Seu acesso não permite incluir documentos nesta empresa"});
    const empresaId=Number(request.headers["x-empresa-id"]||session.rows[0].empresa_ativa_id||0);
    if(!empresaId)return response.status(400).json({error:"Selecione uma empresa antes de importar"});
    const membership=await pool.query(`SELECT e.ativo,eu.permissoes FROM empresas e
      LEFT JOIN empresa_users eu ON eu.empresa_id=e.id AND eu.user_id=$2 WHERE e.id=$1`,[empresaId,session.rows[0].user_id]);
    if(!membership.rowCount||membership.rows[0].ativo===false)return response.status(403).json({error:"Empresa inválida ou desativada"});
    if(session.rows[0].role!=="admin"&&membership.rows[0].permissoes?.documentos_incluir===false)
      return response.status(403).json({error:"Seu acesso não permite incluir documentos nesta empresa"});
    const form = formidable({ multiples: true, maxFileSize: 20 * 1024 * 1024 });
    const [, files] = await form.parse(request);
    const candidates = Object.values(files).flat().filter(Boolean);
    if (!candidates.length)
      return response.status(400).json({ error: "Nenhum XML enviado" });
    const imported = [],errors=[];
    for (const file of candidates) {
      try{
      const xml = (await fs.readFile(file.filepath, "utf8")).replace(/^\uFEFF/,"");
      if (!/<(?:NFe|CTe|NFSe|nfeProc|cteProc|infNFe|infCte|infNFSe|CompNfse)\b/i.test(xml)){
        errors.push({file:file.originalFilename,error:"XML não reconhecido como NF-e, CT-e ou NFS-e"});continue;
      }
      const item = summarize(xml, file.originalFilename);
      if(item.chave){
        const duplicate=await pool.query(`SELECT id FROM documents WHERE chave=$1::text
          AND empresa_id IS NOT DISTINCT FROM $2 LIMIT 1`,[item.chave,empresaId]);
        if(duplicate.rowCount){
          imported.push({id:duplicate.rows[0].id,chave:item.chave,file_name:item.fileName,duplicate:true,
            status:"já_importado"});
          continue;
        }
      }
      const result = await pool.query(
        `INSERT INTO documents
          (empresa_id,kind,chave,numero,data_emissao,valor_total,status,xml_data,source,file_name,remetente_nome,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,'upload',$9,$10,$11)
         RETURNING *`,
        [empresaId,item.kind,item.chave,item.numero,item.dataEmissao || null,
         item.valor,item.status,xml,item.fileName,item.remetente,session.rows[0].user_id],
      );
      await pool.query(`INSERT INTO empresa_activity_log(empresa_id,user_id,acao,modulo,entidade_id,detalhes)
        VALUES($1,$2,'incluiu','documentos',$3,$4::jsonb)`,[empresaId,
        session.rows[0].user_id,String(result.rows[0].id),JSON.stringify({chave:item.chave,arquivo:item.fileName})]);
      imported.push(result.rows[0]);
      }catch(error){errors.push({file:file.originalFilename,error:String(error?.message||error).slice(0,220)})}
    }
    const novos=imported.filter(item=>!item.duplicate).length,duplicados=imported.filter(item=>item.duplicate).length;
    return response.json({ ok: true, importados:novos, duplicados, falhas:errors.length,errors,items: imported });
  } catch (error) {
    console.error("upload error", error);
    return response.status(500).json({ error:`Falha ao importar XML: ${String(error?.message||error).slice(0,220)}` });
  }
}
