// =============================================================================
//  db/index.js — conexão SQLite (node:sqlite nativo) + migração do schema
// =============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let DatabaseSync;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch (e) {
  // Algumas versões do Node (22.5 a ~22.12) só liberam node:sqlite com a flag
  // --experimental-sqlite. O bootstrap (server.js) detecta e reinicia.
  throw e;
}

const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Carrega e executa o schema (idempotente)
const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
db.exec(schemaSql);

// Migração leve: adiciona colunas que podem faltar em banco pré-existente.
// Mantém compatibilidade com installations que rodaram o v2 sem o xml_data.
function ensureColumn(table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
try { ensureColumn("documents", "xml_data", "TEXT"); } catch (e) { console.error("[migration] ensureColumn xml_data falhou:", e.message); }
try { ensureColumn("users", "avatar_path", "TEXT"); } catch (e) { console.error("[migration] ensureColumn avatar_path falhou:", e.message); }
for (const [column, type] of [
  ["cargo", "TEXT"], ["area_atuacao", "TEXT"], ["bio", "TEXT"],
  ["linkedin_url", "TEXT"], ["instagram_url", "TEXT"], ["website_url", "TEXT"],
  ["telefone", "TEXT"], ["preferencias", "TEXT"]
]) {
  try { ensureColumn("users", column, type); } catch (e) { console.error(`[migration] perfil ${column} falhou:`, e.message); }
}

// v2.3 — campos enriquecidos para filtros de Documentos (item 9 da lista de requisitos)
const NEW_DOC_COLS = [
  ["emitente_cnpj", "TEXT"],
  ["emitente_razao_social", "TEXT"],
  ["emitente_nome_fantasia", "TEXT"],
  ["destinatario_tomador_doc", "TEXT"],
  ["destinatario_tomador_nome", "TEXT"],
  ["cancelado", "INTEGER NOT NULL DEFAULT 0"],
  ["data_cancelamento", "TEXT"],
  ["registrada_erp", "INTEGER NOT NULL DEFAULT 0"],
  ["data_registro_erp", "TEXT"],
  ["registro_invalido", "INTEGER NOT NULL DEFAULT 0"],
  ["invalidado", "INTEGER NOT NULL DEFAULT 0"],
  ["assinatura_invalida", "INTEGER NOT NULL DEFAULT 0"],
  ["schema_invalido", "INTEGER NOT NULL DEFAULT 0"],
  ["tipo_documento", "TEXT"],
  ["documento_terceiros", "INTEGER NOT NULL DEFAULT 0"],
  ["carta_correcao", "INTEGER NOT NULL DEFAULT 0"],
  ["eventos", "TEXT"],
  ["ultima_manifestacao", "TEXT"],
  ["data_ultima_manifestacao", "TEXT"],
  ["sem_manifestacao", "INTEGER NOT NULL DEFAULT 0"],
  ["data_validacao_regra", "TEXT"],
  ["regra_validacao", "TEXT"],
  ["regra_violada", "TEXT"],
  ["finalidade_emissao", "TEXT"],
  ["tipo_operacao", "TEXT"],
  // v2.4 — papel do documento em relação à empresa ativa (Item #7: NFs destinadas)
  //   'emitida'    → a empresa ativa é o REMETENTE/EMITENTE
  //   'destinada'  → a empresa ativa é o DESTINATÁRIO/TOMADOR
  //   'desconhecida' → não foi possível determinar (empresa ativa != emitente e != destinatário)
  ["papel", "TEXT"],
];
for (const [col, type] of NEW_DOC_COLS) {
  try { ensureColumn("documents", col, type); } catch (e) { console.error(`[migration] ensureColumn ${col} falhou:`, e.message); }
}

// Índices para os filtros mais usados
const NEW_DOC_INDEXES = [
  ["idx_docs_emitente_cnpj", "documents(emitente_cnpj)"],
  ["idx_docs_chave", "documents(chave)"],
  ["idx_docs_cancelado", "documents(cancelado)"],
  ["idx_docs_data_cancelamento", "documents(data_cancelamento)"],
  ["idx_docs_data_registro_erp", "documents(data_registro_erp)"],
  ["idx_docs_tipo_documento", "documents(tipo_documento)"],
  ["idx_docs_finalidade", "documents(finalidade_emissao)"],
];
for (const [name, spec] of NEW_DOC_INDEXES) {
  try { db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${spec}`); } catch (e) { console.error(`[migration] index ${name} falhou:`, e.message); }
}

// v3 — Multi-tenancy
try { ensureColumn("documents", "empresa_id", "INTEGER"); } catch (e) { console.error("[migration] ensureColumn empresa_id falhou:", e.message); }
try { ensureColumn("users", "last_empresa_id", "INTEGER"); } catch (e) { console.error("[migration] ensureColumn last_empresa_id falhou:", e.message); }
try { ensureColumn("sessions", "empresa_ativa_id", "INTEGER"); } catch (e) { console.error("[migration] ensureColumn empresa_ativa_id falhou:", e.message); }
try { db.exec("CREATE INDEX IF NOT EXISTS idx_docs_empresa ON documents(empresa_id)"); } catch (e) { console.error("[migration] idx_docs_empresa falhou:", e.message); }

export default db;
