import fs from "node:fs/promises";
import formidable from "formidable";
import { ensureSchema, pool } from "../_database.js";

export const config={api:{bodyParser:false}};
function sid(req){return decodeURIComponent(String(req.headers.cookie||"").match(/(?:^|;\s*)sid=([^;]+)/)?.[1]||"");}
function safeName(value){
  return String(value||"certidao.pdf").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[\\/:*?"<>|\x00-\x1F]/g,"_").replace(/[^\x20-\x7E]/g,"_")
    .replace(/\s+/g,"_").slice(0,180);
}
export default async function handler(req,res){
  try{
    if(req.method!=="POST") return res.status(405).json({error:"Método não permitido"});
    await ensureSchema();
    const session=await pool.query("SELECT user_id,empresa_ativa_id FROM sessions WHERE id=$1 AND expires_at>NOW()",[sid(req)]);
    if(!session.rowCount) return res.status(401).json({error:"Não autenticado"});
    const [fields,files]=await formidable({maxFileSize:15*1024*1024,filter:p=>p.mimetype==="application/pdf"}).parse(req);
    const file=Array.isArray(files.pdf)?files.pdf[0]:files.pdf;
    if(!file) return res.status(400).json({error:"Selecione um PDF"});
    const empresaId=Number(req.headers["x-empresa-id"]||fields.empresaId?.[0]||session.rows[0].empresa_ativa_id);
    if(!empresaId) return res.status(400).json({error:"Selecione uma empresa"});
    const bytes=await fs.readFile(file.filepath);
    const company=await pool.query("SELECT nome FROM empresas WHERE id=$1 AND ativo=TRUE",[empresaId]);
    if(!company.rowCount) return res.status(404).json({error:"Empresa não encontrada"});
    const saved=await pool.query(`INSERT INTO certidoes(user_id,empresa_id,empresa_nome,tipo,status,observacoes,pdf_data,pdf_name)
      VALUES($1,$2,$3,'federal','negativa','Importada do PDF; revise os dados reconhecidos.',$4,$5) RETURNING id`,
      [session.rows[0].user_id,empresaId,company.rows[0].nome,bytes,safeName(file.originalFilename)]);
    return res.json({ok:true,id:Number(saved.rows[0].id),missing:["tipo","status","data de emissão","data de validade"],
      message:"PDF importado. Abra a certidão para revisar tipo, status e datas."});
  }catch(error){console.error(error);return res.status(500).json({error:"Não foi possível importar o PDF"});}
}
