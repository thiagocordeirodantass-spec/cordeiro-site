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
try { ensureColumn("empresas", "empresa_matriz_id", "INTEGER"); } catch (e) { console.error("[migration] empresa_matriz_id falhou:", e.message); }
try { ensureColumn("empresas", "im", "TEXT"); } catch (e) { console.error("[migration] im falhou:", e.message); }
try { ensureColumn("empresas", "requer_certificado", "INTEGER NOT NULL DEFAULT 0"); } catch (e) { console.error("[migration] requer_certificado falhou:", e.message); }
try { ensureColumn("sessions", "auth_method", "TEXT NOT NULL DEFAULT 'password'"); } catch (e) { console.error("[migration] auth_method falhou:", e.message); }
try {
  db.exec(`CREATE TABLE IF NOT EXISTS empresa_alert_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(empresa_id,email)
  )`);
} catch (e) { console.error("[migration] empresa_alert_emails falhou:", e.message); }
const EMPRESAS_PADRAO = [
  ["61779867000181","ALM LOG","ALM LOG",null,"4BP6493"],
  ["11554415000123","ANG Participações","ANG Participações",null,"4980807"],
  ["11613649000102","Intecom Participações","Intecom Participações",null,"4578023"],
  ["03857930000154","INTECOM SERVICOS DE LOGISTICA LTDA","Intecom Serviços","206256630112","4512683"],
  ["10761960000128","IW Serviços","IW Serviços","206274460117","4540569"],
  ["12142391000168","SP Empreendimentos","SP Empreendimentos",null,"4625238"],
];
for (const row of EMPRESAS_PADRAO) {
  try {
    db.prepare(`INSERT INTO empresas(cnpj,nome,nome_fantasia,ie,im,ambiente,ativo,requer_certificado)
      VALUES(?,?,?,?,?,'producao',1,?) ON CONFLICT(cnpj) DO UPDATE SET
      nome=excluded.nome,nome_fantasia=excluded.nome_fantasia,ie=excluded.ie,im=excluded.im,
      requer_certificado=excluded.requer_certificado`).run(...row,row[0] === "03857930000154" ? 1 : 0);
  } catch (e) { console.error("[seed] empresa falhou:", e.message); }
}
const matrizIntecom = db.prepare("SELECT id FROM empresas WHERE cnpj = ?").get("03857930000154");
if (matrizIntecom) {
  const FILIAIS_INTECOM = [
    ["03857930000901","Intecom Betim","0032136030191","1644650011"],
    ["03857930000740","Intecom Cajamar","241097223118","15861"],
    ["03857930001207","Intecom Conde I","164001085","20203113"],
    ["03857930001398","Intecom Extrema","0032136030272","0017760"],
    ["03857930001479","Intecom Itapoá","262714132","40908"],
    ["03857930000405","Intecom Conde II","161617727","20263671"],
  ];
  for (const row of FILIAIS_INTECOM) {
    try {
      db.prepare(`INSERT INTO empresas(cnpj,nome,nome_fantasia,ie,im,ambiente,ativo,empresa_matriz_id)
        VALUES(?,?,?,?,?,'producao',1,?) ON CONFLICT(cnpj) DO UPDATE SET
        nome=excluded.nome,nome_fantasia=excluded.nome_fantasia,ie=excluded.ie,im=excluded.im,
        empresa_matriz_id=excluded.empresa_matriz_id`).run(...row,matrizIntecom.id);
    } catch (e) { console.error("[seed] filial falhou:", e.message); }
  }
  try {
    db.prepare(`UPDATE empresas SET empresa_matriz_id=?
      WHERE cnpj LIKE '03857930%' AND cnpj<>'03857930000154'`).run(matrizIntecom.id);
  } catch (e) { console.error("[seed] vínculo matriz/filiais falhou:", e.message); }
}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_docs_empresa ON documents(empresa_id)"); } catch (e) { console.error("[migration] idx_docs_empresa falhou:", e.message); }

export default db;
