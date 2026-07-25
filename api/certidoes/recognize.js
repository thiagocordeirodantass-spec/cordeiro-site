import fs from "node:fs/promises";
import formidable from "formidable";
import { PDFParse } from "pdf-parse";
import { ensureSchema, pool } from "../_database.js";

export const config={api:{bodyParser:false}};
function sid(req){return decodeURIComponent(String(req.headers.cookie||"").match(/(?:^|;\s*)sid=([^;]+)/)?.[1]||"");}
function safeName(value){
  return String(value||"certidao.pdf").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[\\/:*?"<>|\x00-\x1F]/g,"_").replace(/[^\x20-\x7E]/g,"_")
    .replace(/\s+/g,"_").slice(0,180);
}
function parseDate(value){
  const match=String(value||"").match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  return match?`${match[3]}-${match[2]}-${match[1]}`:null;
}
export default async function handler(req,res){
  let stage="inicialização",parser;
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
    stage="leitura do arquivo";
    const bytes=await fs.readFile(file.filepath);
    stage="extração do texto";
    parser=new PDFParse({data:bytes});
    const parsed=await parser.getText();
    await parser.destroy();
    parser=null;
    const text=String(parsed.text||"").replace(/\s+/g," ").trim();
    if(text.length<30)return res.status(422).json({error:"O PDF não possui texto pesquisável suficiente para leitura automática"});
    const normalized=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
    const cnpj=text.match(/\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}/)?.[0].replace(/\D/g,"")||"";
    let company=cnpj?await pool.query(`SELECT id,nome FROM empresas
      WHERE regexp_replace(cnpj,'\\D','','g')=$1 AND ativo=TRUE LIMIT 1`,[cnpj]):{rowCount:0,rows:[]};
    if(!company.rowCount)company=await pool.query("SELECT id,nome FROM empresas WHERE id=$1 AND ativo=TRUE",[empresaId]);
    if(!company.rowCount) return res.status(404).json({error:"Empresa não encontrada"});
    const allDates=[...text.matchAll(/\d{2}[\/.-]\d{2}[\/.-]\d{4}/g)].map(match=>match[0]);
    const emissionRaw=text.match(/(?:EMISS[AÃ]O|EMITIDA?)(?:\s+EM|\s*:)?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i)?.[1];
    const validityRaw=text.match(/(?:VALIDADE|V[AÁ]LIDA?\s+AT[EÉ])(?:\s*:|\s+AT[EÉ])?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i)?.[1];
    const dataEmissao=parseDate(emissionRaw||allDates[0]);
    const filenameDate=String(file.originalFilename||"").match(/(?:VALIDADE[_\s-]*)?(\d{2}[.-]\d{2}[.-]\d{4})/i)?.[1];
    const dataValidade=parseDate(validityRaw||filenameDate||allDates.find(date=>date!==emissionRaw&&date!==allDates[0])||allDates[1]);
    const tipo=/FGTS|FUNDO DE GARANTIA/.test(normalized)?"fgts":/TRABALHIST|CNDT/.test(normalized)?"cndt":
      /IMOBILI|IPTU/.test(normalized)?"imobiliario":/MUNICIP|PREFEITURA|ISS/.test(normalized)?"municipal":
      /ESTADUAL|FAZENDA DO ESTADO|ICMS/.test(normalized)?"estadual":"federal";
    const status=/POSITIVA COM EFEITOS? DE NEGATIVA/.test(normalized)?"positiva_com_efeitos_de_negativa":
      /CERTIDAO POSITIVA|CERTIDAO DEBITO|CONSTAM DEBITOS/.test(normalized)?"positiva":"negativa";
    const numero=text.match(/(?:N[ÚU]MERO|N[º°O]\.?|C[ÓO]DIGO)(?:\s+DA\s+CERTID[AÃ]O)?\s*[:\-]?\s*([A-Z0-9./-]{5,})/i)?.[1]||null;
    const days=dataValidade?Math.ceil((new Date(`${dataValidade}T23:59:59`).getTime()-Date.now())/86400000):null;
    const prazo=10;
    const diagnostico=days==null?"Validade não identificada":days<0?`Vencida há ${Math.abs(days)} dia(s)`:
      days<=prazo?`Próxima do vencimento: ${days} dia(s) restante(s)`:`Válida: ${days} dia(s) restante(s)`;
    stage="gravação da certidão";
    const saved=await pool.query(`INSERT INTO certidoes(user_id,empresa_id,empresa_nome,tipo,status,numero_certidao,
      data_emissao,data_validade,observacoes,pdf_data,pdf_name)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [session.rows[0].user_id,company.rows[0].id,company.rows[0].nome,tipo,status,numero,dataEmissao,dataValidade,
       `PDF lido integralmente. Diagnóstico automático: ${diagnostico}.`,bytes,safeName(file.originalFilename)]);
    const missing=[];if(!cnpj)missing.push("CNPJ");if(!dataEmissao)missing.push("data de emissão");
    if(!dataValidade)missing.push("data de validade");if(!numero)missing.push("número");
    return res.json({ok:true,id:Number(saved.rows[0].id),recognized:{cnpj,tipo,status,numero,dataEmissao,dataValidade},
      diagnostico,missing,message:`Certidão lida, vinculada a ${company.rows[0].nome} e diagnosticada: ${diagnostico}.`});
  }catch(error){
    if(parser)try{await parser.destroy()}catch{}
    console.error("CND recognize",stage,error);
    const detail=String(error?.message||"falha desconhecida").replace(/postgresql:\/\/\S+/gi,"[conexão protegida]").slice(0,240);
    return res.status(500).json({error:`Não foi possível importar o PDF durante ${stage}: ${detail}`,stage});
  }
}
