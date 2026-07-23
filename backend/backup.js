// =============================================================================
//  backup.js — backup do banco SQLite + pasta de XMLs
//  Uso: node backup.js [destino]
//  Padrão destino: ./backups/YYYY-MM-DD_HHmmss/
// =============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

const stamp = new Date().toISOString().replace(/T/, "_").replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR = path.resolve(
  process.argv[2] || path.join(ROOT, "backups", stamp)
);

fs.mkdirSync(OUT_DIR, { recursive: true });

// 1. Copia o banco SQLite (usa o sqlite3 .backup se disponível, senão fs.copy)
let copiedDb = false;
try {
  const { DatabaseSync } = await import("node:sqlite");
  const src = new DatabaseSync(DB_PATH, { readOnly: true });
  const dstPath = path.join(OUT_DIR, "app.db");
  // .backup() faz um snapshot consistente mesmo com o banco em uso (WAL)
  src.exec(`VACUUM INTO '${dstPath.replace(/'/g, "''")}'`);
  src.close();
  copiedDb = true;
  console.log(`[backup] banco copiado: ${dstPath}`);
} catch (e) {
  console.warn("[backup] VACUUM INTO falhou, caindo para fs.copy:", e.message);
  fs.copyFileSync(DB_PATH, path.join(OUT_DIR, "app.db"));
  fs.copyFileSync(DB_PATH + "-wal", path.join(OUT_DIR, "app.db-wal")).catch(() => {});
  fs.copyFileSync(DB_PATH + "-shm", path.join(OUT_DIR, "app.db-shm")).catch(() => {});
  copiedDb = true;
}

// 2. Copia a pasta de XMLs (pode ser grande — só copia se existir)
const XML_DIR = path.join(DATA_DIR, "xml");
if (fs.existsSync(XML_DIR)) {
  const outXml = path.join(OUT_DIR, "xml");
  fs.cpSync(XML_DIR, outXml, { recursive: true });
  const total = fs.readdirSync(XML_DIR).length;
  console.log(`[backup] XMLs copiados: ${total} arquivo(s)`);
} else {
  console.log("[backup] pasta xml/ nao existe, pulando");
}

console.log(`[backup] OK -> ${OUT_DIR}`);
