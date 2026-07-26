import fs from "node:fs/promises";
import formidable from "formidable";
import {ensureSchema,pool} from "../_database.js";

export const config={api:{bodyParser:false},maxDuration:20};
function sid(req){return decodeURIComponent(String(req.headers.cookie||"").match(/(?:^|;\s*)sid=([^;]+)/)?.[1]||"");}
export default async function handler(req,res){
  try{
    await ensureSchema();
    const user=await pool.query(`SELECT u.id,u.avatar_data,u.avatar_mime FROM sessions s
      JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>NOW() AND u.ativo=TRUE`,[sid(req)]);
    if(!user.rowCount)return res.status(401).json({error:"Não autenticado"});
    if(req.method==="GET"){
      if(!user.rows[0].avatar_data)return res.status(404).json({error:"Foto não cadastrada"});
      res.setHeader("Content-Type",user.rows[0].avatar_mime||"image/jpeg");
      res.setHeader("Cache-Control","private, max-age=300");
      return res.send(user.rows[0].avatar_data);
    }
    if(req.method==="DELETE"){
      await pool.query("UPDATE users SET avatar_data=NULL,avatar_mime=NULL WHERE id=$1",[user.rows[0].id]);
      return res.json({ok:true});
    }
    if(req.method!=="POST")return res.status(405).json({error:"Método não permitido"});
    const [,files]=await formidable({maxFileSize:5*1024*1024,allowEmptyFiles:false,
      filter:part=>["image/png","image/jpeg","image/webp"].includes(part.mimetype||"")}).parse(req);
    const file=Object.values(files).flat().find(Boolean);
    if(!file)return res.status(400).json({error:"Selecione uma imagem PNG, JPEG ou WebP de até 5 MB"});
    const bytes=await fs.readFile(file.filepath);
    await pool.query("UPDATE users SET avatar_data=$2::bytea,avatar_mime=$3 WHERE id=$1",
      [user.rows[0].id,bytes,file.mimetype]);
    return res.json({ok:true,avatar_url:`/api/auth/avatar?v=${Date.now()}`});
  }catch(error){
    console.error("avatar error",error);
    return res.status(500).json({error:`Não foi possível alterar a foto: ${String(error?.message||error).slice(0,180)}`});
  }
}
