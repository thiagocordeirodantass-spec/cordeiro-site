import crypto from "node:crypto";
import {pool} from "./_database.js";

function key(){
  const secret=process.env.CERTIFICATE_ENCRYPTION_KEY||process.env.ARMAZENAR_DATABASE_URL||process.env.DATABASE_URL;
  if(!secret)throw new Error("Chave de proteção do certificado não configurada");
  return crypto.createHash("sha256").update(secret).digest();
}
export function encryptCertificate(pfx,password){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);
  const plain=Buffer.from(JSON.stringify({pfx:Buffer.from(pfx).toString("base64"),password:String(password)}));
  const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),encrypted]);
}
export function decryptCertificate(payload){
  const bytes=Buffer.from(payload),decipher=crypto.createDecipheriv("aes-256-gcm",key(),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  const value=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString("utf8"));
  return {pfx:Buffer.from(value.pfx,"base64"),passphrase:value.password};
}
export async function getCompanyCertificate(empresaId){
  const result=await pool.query("SELECT encrypted_payload,cnpj FROM empresa_certificados WHERE empresa_id=$1",[empresaId]);
  if(result.rowCount)return {...decryptCertificate(result.rows[0].encrypted_payload),cnpj:result.rows[0].cnpj};
  if(process.env.SEFAZ_PFX_BASE64&&process.env.SEFAZ_PFX_PASSWORD)return {
    pfx:Buffer.from(process.env.SEFAZ_PFX_BASE64,"base64"),
    passphrase:process.env.SEFAZ_PFX_PASSWORD,
    cnpj:process.env.SEFAZ_CNPJ,
  };
  return null;
}
