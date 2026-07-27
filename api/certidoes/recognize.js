import fs from "node:fs/promises";
import formidable from "formidable";
import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { ensureSchema, pool } from "../_database.js";

export const config={api:{bodyParser:false},maxDuration:60};
function sid(req){return decodeURIComponent(String(req.headers.cookie||"").match(/(?:^|;\s*)sid=([^;]+)/)?.[1]||"");}
function safeName(value){
  return String(value||"certidao.pdf").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[\\/:*?"<>|\x00-\x1F]/g,"_").replace(/[^\x20-\x7E]/g,"_")
    .replace(/\s+/g,"_").slice(0,180);
}
function parseDate(value){
  const source=String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const numeric=source.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if(numeric)return `${numeric[3]}-${numeric[2].padStart(2,"0")}-${numeric[1].padStart(2,"0")}`;
  const months={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,
    agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
  const written=source.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  const month=written&&months[written[2]];
  return month?`${written[3]}-${String(month).padStart(2,"0")}-${written[1].padStart(2,"0")}`:null;
}
function extractCertificateNumber(text){
  const patterns=[
    /(?:N[ÚU]MERO|N[º°O]\.?|CERTID[AÃ]O\s+N[º°O]?\.?)(?:\s+DA\s+CERTID[AÃ]O)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9./_-]{3,})/i,
    /(?:C[ÓO]DIGO|CHAVE)\s+(?:DE\s+)?(?:CONTROLE|AUTENTICIDADE|VALIDA[CÇ][AÃ]O)(?:\s+DA\s+CERTID[AÃ]O)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9.\-_/ ]{4,40})/i,
    /CERTID[AÃ]O\s+(?:NEGATIVA|POSITIVA)?(?:\s+DE\s+[A-ZÀ-Ú ]+)?\s+N[º°O]?\s*([A-Z0-9][A-Z0-9./_-]{3,})/i,
    /\b(?:CONTROLE|AUTENTICA[CÇ][AÃ]O)\s*[:#\-]\s*([A-Z0-9][A-Z0-9.\-_/ ]{4,40})/i,
  ];
  for(const pattern of patterns){
    const value=text.match(pattern)?.[1]?.trim().replace(/\s{2,}/g," ");
    if(value&&!/^(DA|DE|DO|DOS|DAS|CERTIDAO)$/i.test(value))return value.slice(0,80);
  }
  return null;
}
function findLabeledDate(text,labels){
  const datePattern="(\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{4}|\\d{1,2}\\s+de\\s+[A-Za-zÀ-ÿ]+\\s+de\\s+\\d{4})";
  return text.match(new RegExp(`(?:${labels})(?:\\s+EM|\\s*:|\\s+AT[EÉ]|\\s+AT[EÉ]\\s*:)?\\s*${datePattern}`,"i"))?.[1]||null;
}
export default async function handler(req,res){
  let stage="inicialização",parser;
  try{
    if(req.method!=="POST") return res.status(405).json({error:"Método não permitido"});
    await ensureSchema();
    const session=await pool.query("SELECT user_id,empresa_ativa_id FROM sessions WHERE id=$1 AND expires_at>NOW()",[sid(req)]);
    if(!session.rowCount) return res.status(401).json({error:"Não autenticado"});
    const [fields,files]=await formidable({
      maxFileSize:15*1024*1024,
      allowEmptyFiles:false,
      filter:part=>part.mimetype==="application/pdf"||/\.pdf$/i.test(part.originalFilename||""),
    }).parse(req);
    const file=Array.isArray(files.pdf)?files.pdf[0]:files.pdf;
    if(!file) return res.status(400).json({error:"Selecione um PDF"});
    const empresaId=Number(req.headers["x-empresa-id"]||fields.empresaId?.[0]||session.rows[0].empresa_ativa_id);
    if(!empresaId) return res.status(400).json({error:"Selecione uma empresa"});
    stage="leitura do arquivo";
    const bytes=await fs.readFile(file.filepath);
    if(bytes.length<5||bytes.subarray(0,5).toString("ascii")!=="%PDF-")
      return res.status(422).json({error:"O arquivo enviado não é um PDF válido"});
    stage="extração do texto";
    globalThis.DOMMatrix??=DOMMatrix;
    globalThis.ImageData??=ImageData;
    globalThis.Path2D??=Path2D;
    const {PDFParse}=await import("pdf-parse");
    parser=new PDFParse({data:bytes});
    const parsed=await parser.getText();
    await parser.destroy();
    parser=null;
    const text=String(parsed.text||"").replace(/\s+/g," ").trim();
    if(text.length<30)return res.status(422).json({error:"O PDF não possui texto pesquisável suficiente para leitura automática"});
    const normalized=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
    const cnpjs=[...new Set([...text.matchAll(/\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}/g)]
      .map(match=>match[0].replace(/\D/g,"")))];
    const companySelect=`SELECT e.id,e.nome,e.nome_fantasia,e.cnpj,e.empresa_matriz_id,m.nome matriz_nome
      FROM empresas e LEFT JOIN empresas m ON m.id=e.empresa_matriz_id`;
    const activeCompany=await pool.query(`${companySelect} WHERE e.id=$1 AND e.ativo=TRUE`,[empresaId]);
    if(!activeCompany.rowCount) return res.status(404).json({error:"Empresa não encontrada"});
    const recognizedCnpj=String(cnpjs[0]||"").replace(/\D/g,"");
    const matchedCompany=recognizedCnpj?await pool.query(
      `${companySelect} WHERE regexp_replace(COALESCE(e.cnpj,''),'\\D','','g')=$1 AND e.ativo=TRUE ORDER BY e.id LIMIT 1`,
      [recognizedCnpj],
    ):{rows:[],rowCount:0};
    const company=matchedCompany.rowCount?matchedCompany.rows[0]:activeCompany.rows[0];
    const branchName=String(company.nome_fantasia||company.nome||"").trim();
    const companyDisplay=company.empresa_matriz_id
      ?`${String(company.matriz_nome||company.nome).trim()} · ${branchName}`
      :String(company.nome||"Empresa ativa").trim();
    const cnpj=recognizedCnpj||String(company.cnpj||"").replace(/\D/g,"");
    const dateExpression=/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+\s+de\s+\d{4}/gi;
    const allDates=[...text.matchAll(dateExpression)].map(match=>match[0]);
    const emissionRaw=findLabeledDate(text,"EMISS[AÃ]O|EMITIDA?|EXPEDI[CÇ][AÃ]O|GERADA?");
    const validityRaw=findLabeledDate(text,"VALIDADE|V[AÁ]LIDA?\\s+AT[EÉ]|VENCIMENTO");
    const dataEmissao=parseDate(emissionRaw||allDates[0]);
    const filenameDate=String(file.originalFilename||"").match(/(?:VALIDADE[_\s-]*)?(\d{2}[.-]\d{2}[.-]\d{4})/i)?.[1];
    let dataValidade=parseDate(validityRaw||filenameDate||allDates.find(date=>date!==emissionRaw&&date!==allDates[0])||allDates[1]);
    if(!dataValidade&&dataEmissao){
      const validDays=Number(text.match(/V[AÁ]LIDA?\s+(?:PELO\s+PRAZO\s+)?(?:POR\s+)?(\d{1,3})\s+DIAS/i)?.[1]||0);
      if(validDays){const calculated=new Date(`${dataEmissao}T12:00:00Z`);calculated.setUTCDate(calculated.getUTCDate()+validDays);
        dataValidade=calculated.toISOString().slice(0,10);}
    }
    const tipo=/FGTS|FUNDO DE GARANTIA/.test(normalized)?"fgts":/TRABALHIST|CNDT/.test(normalized)?"cndt":
      /IMOBILI|IPTU/.test(normalized)?"imobiliario":/MUNICIP|PREFEITURA|ISS/.test(normalized)?"municipal":
      /ESTADUAL|FAZENDA DO ESTADO|ICMS/.test(normalized)?"estadual":"federal";
    const status=/POSITIVA COM EFEITOS? DE NEGATIVA/.test(normalized)?"positiva_com_efeitos_de_negativa":
      /CERTIDAO POSITIVA|CERTIDAO DEBITO|CONSTAM DEBITOS/.test(normalized)?"positiva":"negativa";
    const numero=extractCertificateNumber(text);
    const orgao=text.match(/((?:PREFEITURA|SECRETARIA|PROCURADORIA|MINIST[EÉ]RIO|CAIXA ECON[ÔO]MICA|TRIBUNAL)[^.]{3,100})/i)?.[1]?.trim()||null;
    const totalPages=Number(parsed.total||parsed.numpages||parsed.pages?.length||0)||null;
    const days=dataValidade?Math.ceil((new Date(`${dataValidade}T23:59:59`).getTime()-Date.now())/86400000):null;
    const prazo=10;
    const diagnostico=days==null?"Validade não identificada":days<0?`Vencida há ${Math.abs(days)} dia(s)`:
      days<=prazo?`Próxima do vencimento: ${days} dia(s) restante(s)`:`Válida: ${days} dia(s) restante(s)`;
    stage="gravação da certidão";
    const saved=await pool.query(`INSERT INTO certidoes(user_id,empresa_id,empresa_nome,tipo,status,numero_certidao,
      data_emissao,data_validade,observacoes,pdf_data,pdf_name,orgao,cnpj,razao_social,situacao,
      emitida_em,valida_ate,numero)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::bytea,$11,$12,$13,$14,$15,$7,$8,$6) RETURNING *`,
      [session.rows[0].user_id,company.id,companyDisplay,tipo,status,numero,dataEmissao,dataValidade,
       `PDF lido integralmente${totalPages?` (${totalPages} página(s))`:""}. Diagnóstico automático: ${diagnostico}.`,
       bytes,safeName(file.originalFilename),orgao,cnpj,company.nome,status]);
    const missing=[];if(!cnpj)missing.push("CNPJ");if(!dataEmissao)missing.push("data de emissão");
    if(!dataValidade)missing.push("data de validade");if(!numero)missing.push("número");
    const row=saved.rows[0];
    return res.json({ok:true,id:Number(row.id),document:{...row,pdf_data:undefined,pdf_url:`/api/cnd-pdf?id=${row.id}`},
      recognized:{cnpj,razaoSocial:company.nome,
      orgao,tipo,status,numero,dataEmissao,dataValidade,totalPages},
      diagnostico,missing,message:`Certidão lida, vinculada a ${companyDisplay} e diagnosticada: ${diagnostico}.`});
  }catch(error){
    if(parser)try{await parser.destroy()}catch{}
    console.error("CND recognize",stage,error);
    const detail=String(error?.message||"falha desconhecida").replace(/postgresql:\/\/\S+/gi,"[conexão protegida]").slice(0,240);
    return res.status(500).json({error:`Não foi possível importar o PDF durante ${stage}: ${detail}`,stage});
  }
}
