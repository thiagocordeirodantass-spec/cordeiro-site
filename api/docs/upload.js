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
  const keyMatch = xml.match(/(?:Id="(?:NFe|CTe))(\d{44})"/i);
  const chave = keyMatch?.[1] || first(xml, ["chNFe", "chCTe"]);
  return {
    kind: isCte ? "CTE" : "NFE",
    chave: chave?.replace(/\D/g, "").slice(0, 44) || null,
    numero: first(xml, ["nCT", "nNF"]),
    dataEmissao: first(xml, ["dhEmi", "dEmi"]),
    valor: Number(first(xml, ["vNF", "vTPrest", "vRec"]) || 0),
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
          "SELECT empresa_ativa_id FROM sessions WHERE id=$1 AND expires_at>NOW()",
          [decodeURIComponent(sid)],
        )
      : null;
    if (!session?.rowCount)
      return response.status(401).json({ error: "Não autenticado" });
    const form = formidable({ multiples: true, maxFileSize: 20 * 1024 * 1024 });
    const [, files] = await form.parse(request);
    const candidates = Object.values(files).flat().filter(Boolean);
    if (!candidates.length)
      return response.status(400).json({ error: "Nenhum XML enviado" });
    const imported = [];
    for (const file of candidates) {
      const xml = await fs.readFile(file.filepath, "utf8");
      if (!/<(?:NFe|CTe|nfeProc|cteProc|infNFe|infCte)\b/i.test(xml)) continue;
      const item = summarize(xml, file.originalFilename);
      const result = await pool.query(
        `INSERT INTO documents
          (empresa_id,kind,chave,numero,data_emissao,valor_total,status,xml_data,source,file_name,remetente_nome)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,'upload',$9,$10)
         RETURNING *`,
        [session.rows[0].empresa_ativa_id,item.kind,item.chave,item.numero,item.dataEmissao || null,
         item.valor,item.status,xml,item.fileName,item.remetente],
      );
      imported.push(result.rows[0]);
    }
    return response.json({ ok: true, importedados: imported.length, items: imported });
  } catch (error) {
    console.error("upload error", error);
    return response.status(500).json({ error: "Falha ao importar XML" });
  }
}
