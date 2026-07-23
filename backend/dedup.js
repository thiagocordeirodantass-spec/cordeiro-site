// =============================================================================
//  dedup.js — remove duplicatas do banco (mesma chave de 44 dígitos)
//  Uso: node dedup.js
//
//  Estratégia: para cada chave com mais de um registro, mantém o mais
//  antigo (menor id) e remove os outros. O XML em disco é apagado
//  apenas se o registro removido era o único que apontava para ele.
//
//  Rode SEM o backend em execução (acesso exclusivo ao banco).
// =============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const XML_DIR = path.resolve(__dirname, "..", "..", "data", "xml");

console.log("=== Dedup do banco de documentos ===\n");

// 1. Encontra chaves duplicadas
const dupes = db.prepare(`
  SELECT chave, COUNT(*) as total, MIN(id) as keep_id
  FROM documents
  WHERE chave IS NOT NULL AND chave != ''
  GROUP BY chave
  HAVING COUNT(*) > 1
  ORDER BY total DESC
`).all();

if (!dupes.length) {
  console.log("Nenhuma duplicata encontrada. Banco limpo.");
  process.exit(0);
}

console.log(`Encontradas ${dupes.length} chaves duplicadas.\n`);

let totalRemoved = 0;
let filesRemoved = 0;
let filesKept = 0;

for (const d of dupes) {
  // Pega todos os registros dessa chave, do mais novo para o mais antigo
  const rows = db.prepare(
    "SELECT id, xml_path FROM documents WHERE chave = ? ORDER BY id DESC"
  ).all(d.chave);

  // rows[0] é o mais novo (vai ser removido), rows[last] é o mais antigo (mantido)
  const toRemove = rows.filter((r) => r.id !== d.keep_id);

  for (const r of toRemove) {
    // Verifica se o xml_path é referenciado por outro registro antes de apagar
    const stillUsed = db.prepare(
      "SELECT COUNT(*) as c FROM documents WHERE xml_path = ? AND id != ?"
    ).get(r.xml_path, r.id).c;

    db.prepare("DELETE FROM documents WHERE id = ?").run(r.id);
    totalRemoved++;

    if (stillUsed === 0) {
      const full = path.join(XML_DIR, r.xml_path);
      try { fs.unlinkSync(full); filesRemoved++; } catch (e) { /* ja nao existia */ }
    } else {
      filesKept++;
    }
  }

  console.log(`  chave ${d.chave}: mantive id=${d.keep_id}, removi ${toRemove.length}`);
}

console.log(`\n=== Resumo ===`);
console.log(`Registros removidos: ${totalRemoved}`);
console.log(`Arquivos XML apagados: ${filesRemoved}`);
console.log(`Arquivos XML mantidos (compartilhados): ${filesKept}`);
console.log(`\nRecomendação: rode 'node cleanup-xml-orphans.js' agora para pegar sobras.`);
