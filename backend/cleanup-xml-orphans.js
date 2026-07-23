// =============================================================================
//  cleanup-xml-orphans.js — apaga XMLs em data/xml/ que não estão no banco
//  Uso: node cleanup-xml-orphans.js
//
//  Útil para limpar duplicações causadas por importações antes da
//  proteção anti-duplicado (saveDocument agora checa pela chave antes
//  de gravar novo arquivo).
// =============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const XML_DIR = path.resolve(__dirname, "..", "..", "data", "xml");

if (!fs.existsSync(XML_DIR)) {
  console.log("Pasta data/xml/ não existe, nada a fazer.");
  process.exit(0);
}

const used = new Set(
  db.prepare("SELECT DISTINCT xml_path FROM documents").all().map((r) => r.xml_path)
);

const files = fs.readdirSync(XML_DIR);
let removed = 0;
let kept = 0;
for (const f of files) {
  if (used.has(f)) {
    kept++;
  } else {
    fs.unlinkSync(path.join(XML_DIR, f));
    removed++;
    console.log("removido:", f);
  }
}
console.log(`\nResumo: ${kept} mantidos, ${removed} orfãos removidos.`);
