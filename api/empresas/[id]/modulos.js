import { ensureSchema,pool } from "../../_database.js";

function sessionId(req){return decodeURIComponent(String(req.headers.cookie||"").match(/(?:^|;\s*)sid=([^;]+)/)?.[1]||"");}
const defaults={
  cnd:{prazo_alerta:10,alerta_vencimento:true,alerta_vencidas:true,alerta_positivas:true,remetente:""},
  sefaz:{consulta_automatica:true,importar_automaticamente:true,uf:"MG",ult_nsu:"0",somente_consulta:true},
  documentos:{deduplicar:true,importar_xml:true,guardar_xml:true},
  alertas:{email_ativo:true,frequencia:"diaria",hora:"08:00"},
};
export default async function handler(req,res){
  try{
    await ensureSchema();
    const id=Number(req.query.id);
    const auth=await pool.query(`SELECT u.role FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.id=$1 AND s.expires_at>NOW() AND u.ativo=TRUE`,[sessionId(req)]);
    if(!auth.rowCount)return res.status(401).json({error:"Não autenticado"});
    const company=await pool.query("SELECT * FROM empresas WHERE id=$1",[id]);
    if(!company.rowCount)return res.status(404).json({error:"Empresa ou filial não encontrada"});
    if(req.method==="GET"){
      const rows=await pool.query("SELECT modulo,configuracao,ativo FROM empresa_module_config WHERE empresa_id=$1",[id]);
      const modules=structuredClone(defaults);
      for(const row of rows.rows) modules[row.modulo]={...(modules[row.modulo]||{}),...row.configuracao,ativo:row.ativo};
      const emails=await pool.query("SELECT * FROM empresa_alert_emails WHERE empresa_id=$1 ORDER BY email",[id]);
      return res.json({empresa:company.rows[0],modulos:modules,emails:emails.rows});
    }
    if(req.method==="PUT"){
      if(auth.rows[0].role!=="admin")return res.status(403).json({error:"Apenas administradores podem configurar módulos"});
      const modulo=String(req.body?.modulo||"");
      if(!Object.hasOwn(defaults,modulo))return res.status(400).json({error:"Módulo inválido"});
      const config={...defaults[modulo],...(req.body?.configuracao||{})};
      await pool.query(`INSERT INTO empresa_module_config(empresa_id,modulo,configuracao,ativo)
        VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(empresa_id,modulo) DO UPDATE SET
        configuracao=EXCLUDED.configuracao,ativo=EXCLUDED.ativo,updated_at=NOW()`,
        [id,modulo,JSON.stringify(config),req.body?.ativo!==false]);
      return res.json({ok:true,modulo,configuracao:config});
    }
    return res.status(405).json({error:"Método não permitido"});
  }catch(error){console.error(error);return res.status(500).json({error:"Erro ao configurar módulos"});}
}
