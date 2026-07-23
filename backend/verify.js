// =============================================================================
//  verify.js — verifica o estado do banco (sem precisar de sqlite3 externo)
//  Uso: node verify.js
// =============================================================================
import { db } from "./db/index.js";

const dupes = db.prepare(`
  SELECT chave, COUNT(*) as total
  FROM documents
  WHERE chave IS NOT NULL AND chave != ''
  GROUP BY chave
  HAVING COUNT(*) > 1
`).all();

const total = db.prepare("SELECT COUNT(*) as c FROM documents").get().c;
const comChave = db.prepare("SELECT COUNT(*) as c FROM documents WHERE chave IS NOT NULL AND chave != ''").get().c;
const semChave = total - comChave;

console.log("=== Verificação do banco ===");
console.log(`Total de documentos: ${total}`);
console.log(`  com chave: ${comChave}`);
console.log(`  sem chave: ${semChave}`);
console.log(`Duplicatas por chave: ${dupes.length}`);
if (dupes.length) {
  console.log("  primeiras 10:");
  dupes.slice(0, 10).forEach((d) => console.log(`    chave ${d.chave} (${d.total}×)`));
}

const xmlNoBanco = db.prepare("SELECT COUNT(DISTINCT xml_path) as c FROM documents").get().c;
console.log(`Arquivos XML únicos referenciados: ${xmlNoBanco}`);

const cancelados = db.prepare("SELECT COUNT(*) as c FROM documents WHERE status = 'cancelado' OR cancelado = 1").get().c;
console.log(`Documentos cancelados: ${cancelados}`);

console.log("\n" + (dupes.length === 0 ? "✓ Banco limpo (sem duplicatas)" : "✗ Ainda há duplicatas — rode 'node dedup.js'"));
