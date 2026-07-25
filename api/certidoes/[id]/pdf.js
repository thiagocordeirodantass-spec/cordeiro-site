import fs from "node:fs/promises";
import formidable from "formidable";
import { ensureSchema, pool } from "../../_database.js";

export const config={api:{bodyParser:false}};
function sid(req){return decodeURIComponent(String(req.headers.cookie||"").match(/(?:^|;\s*)sid=([^;]+)/)?.[1]||"");}
function safeName(value){return String(value||"certidao.pdf").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[\\/:*?"<>|\x00-\x1F]/g,"_").replace(/[^\x20-\x7E]/g,"_").replace(/\s+/g,"_").slice(0,180);}
export default async function handler(req,res){
  try{
    await ensureSchema();
    const auth=await pool.query("SELECT user_id FROM sessions WHERE id=$1 AND expires_at>NOW()",[sid(req)]);
    if(!auth.rowCount)return res.status(401).json({error:"Não autenticado"});
    const id=Number(req.query.id);
    if(req.method==="POST"){
      const [,files]=await formidable({maxFileSize:15*1024*1024,filter:p=>p.mimetype==="application/pdf"}).parse(req);
      const file=Array.isArray(files.pdf)?files.pdf[0]:files.pdf;
      if(!file)return res.status(400).json({error:"Selecione um PDF"});
      const result=await pool.query("UPDATE certidoes SET pdf_data=$2,pdf_name=$3 WHERE id=$1 RETURNING id",
        [id,await fs.readFile(file.filepath),safeName(file.originalFilename)]);
      if(!result.rowCount)return res.status(404).json({error:"Certidão não encontrada"});
      return res.json({ok:true,pdf_url:`/api/certidoes/${id}/pdf`});
    }
    if(req.method==="GET"){
      const result=await pool.query("SELECT pdf_data,pdf_name FROM certidoes WHERE id=$1",[id]);
      if(!result.rows[0]?.pdf_data)return res.status(404).json({error:"PDF não encontrado"});
      res.setHeader("Content-Type","application/pdf");
      res.setHeader("Content-Disposition",`inline; filename="${String(result.rows[0].pdf_name||"certidao.pdf").replace(/["\r\n]/g,"")}"`);
      return res.send(result.rows[0].pdf_data);
    }
    return res.status(405).json({error:"Método não permitido"});
  }catch(error){console.error(error);return res.status(500).json({error:"Erro ao processar PDF"});}
}
