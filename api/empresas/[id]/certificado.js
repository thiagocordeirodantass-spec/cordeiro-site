import fs from "node:fs/promises";
import formidable from "formidable";
import forge from "node-forge";
import {ensureSchema,pool} from "../../_database.js";
import {encryptCertificate} from "../../_company-certificate.js";

export const config={api:{bodyParser:false},maxDuration:30};
function sid(req){return decodeURIComponent(String(req.headers.cookie||"").match(/(?:^|;\s*)sid=([^;]+)/)?.[1]||"");}
function inspectCertificate(bytes,password){
  const p12=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bytes.toString("binary")),false,String(password));
  let cert=null,hasKey=false;
  for(const content of p12.safeContents)for(const bag of content.safeBags){
    if(bag.cert&&!cert)cert=bag.cert;
    if(bag.key)hasKey=true;
  }
  if(!cert||!hasKey)throw new Error("O arquivo não contém certificado A1 e chave privada");
  const titular=cert.subject.attributes.map(item=>String(item.value||"")).join(" ");
  const digits=titular.replace(/\D/g,"");
  return {cert,titular: titular.slice(0,300),digits};
}
export default async function handler(req,res){
  try{
    await ensureSchema();
    const empresaId=Number(req.query.id),sessionId=sid(req);
    const auth=await pool.query(`SELECT s.user_id,u.role FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.id=$1 AND s.expires_at>NOW() AND u.ativo=TRUE`,[sessionId]);
    if(!auth.rowCount)return res.status(401).json({error:"Não autenticado"});
    const company=await pool.query("SELECT id,cnpj,nome FROM empresas WHERE id=$1 AND ativo=TRUE",[empresaId]);
    if(!company.rowCount)return res.status(404).json({error:"Empresa não encontrada"});
    if(req.method==="GET"){
      const result=await pool.query(`SELECT arquivo_nome,titular,cnpj,validade_inicio,validade_fim,updated_at
        FROM empresa_certificados WHERE empresa_id=$1`,[empresaId]);
      return res.json({configurado:Boolean(result.rowCount),certificado:result.rows[0]||null});
    }
    if(auth.rows[0].role!=="admin")return res.status(403).json({error:"Apenas administradores podem configurar o certificado"});
    if(req.method==="DELETE"){
      await pool.query("DELETE FROM empresa_certificados WHERE empresa_id=$1",[empresaId]);
      await pool.query("UPDATE sessions SET auth_method='password' WHERE id=$1",[sessionId]);
      return res.json({ok:true});
    }
    if(req.method!=="POST")return res.status(405).json({error:"Método não permitido"});
    const [fields,files]=await formidable({maxFileSize:10*1024*1024,allowEmptyFiles:false,
      filter:part=>/\.p(?:fx|12)$/i.test(part.originalFilename||"")}).parse(req);
    const file=Object.values(files).flat().find(Boolean);
    const password=String(fields.password?.[0]||"");
    if(!file||!password)return res.status(400).json({error:"Selecione o arquivo PFX/P12 e informe a senha"});
    const bytes=await fs.readFile(file.filepath),info=inspectCertificate(bytes,password);
    const companyCnpj=String(company.rows[0].cnpj||"").replace(/\D/g,"");
    if(!companyCnpj||!info.digits.includes(companyCnpj))
      return res.status(403).json({error:"O certificado não corresponde ao CNPJ da empresa selecionada"});
    if(info.cert.validity.notAfter.getTime()<=Date.now())
      return res.status(422).json({error:"O certificado está vencido"});
    await pool.query(`INSERT INTO empresa_certificados
      (empresa_id,encrypted_payload,arquivo_nome,titular,cnpj,validade_inicio,validade_fim)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(empresa_id) DO UPDATE SET
      encrypted_payload=EXCLUDED.encrypted_payload,arquivo_nome=EXCLUDED.arquivo_nome,
      titular=EXCLUDED.titular,cnpj=EXCLUDED.cnpj,validade_inicio=EXCLUDED.validade_inicio,
      validade_fim=EXCLUDED.validade_fim,updated_at=NOW()`,
      [empresaId,encryptCertificate(bytes,password),String(file.originalFilename||"certificado.pfx").slice(0,180),
        info.titular,companyCnpj,info.cert.validity.notBefore,info.cert.validity.notAfter]);
    await pool.query("UPDATE sessions SET empresa_ativa_id=$1,auth_method='certificate' WHERE id=$2",[empresaId,sessionId]);
    return res.json({ok:true,configurado:true,certificado:{arquivo_nome:file.originalFilename,
      titular:info.titular,cnpj:companyCnpj,validade_inicio:info.cert.validity.notBefore,
      validade_fim:info.cert.validity.notAfter}});
  }catch(error){
    console.error("empresa certificado",error);
    const message=/Invalid password|PKCS#12 MAC could not be verified/i.test(String(error?.message||""))
      ?"Senha do certificado inválida":String(error?.message||error).slice(0,220);
    return res.status(500).json({error:`Não foi possível configurar o certificado: ${message}`});
  }
}
