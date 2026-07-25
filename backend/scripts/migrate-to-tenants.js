// =============================================================================
//  scripts/migrate-to-tenants.js
//  -----------------------------------------------------------------------------
//  Idempotente. Cria empresa padrão se não houver nenhuma, vincula o admin,
//  atribui todos os documents sem empresa_id a essa empresa, e move os XMLs
//  para data/xml/empresa_{id}/.
//
//  USO:  node backend/scripts/migrate-to-tenants.js
//  Backup é gerado automaticamente em data/backups/ antes da migração.
// =============================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import { db } from "../db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const XML_DIR = path.join(DATA_DIR, "xml");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

function log(msg) { console.log(`[migrate] ${msg}`); }

async function main() {
  // 1) Garante que existe ao menos uma empresa
  let empresa = db.prepare("SELECT * FROM empresas ORDER BY id LIMIT 1").get();
  let empresaId;
  if (!empresa) {
    log("nenhuma empresa encontrada. criando 'Minha Empresa' (CNPJ 00.000.000/0001-00)...");
    // Cria com CNPJ válido
    const info = db.prepare(`
      INSERT INTO empresas (cnpj, nome, ambiente, ativo)
      VALUES ('00000000000100', 'Minha Empresa', 'homologacao', 1)
    `).run();
    empresaId = Number(info.lastInsertRowid);
    empresa = db.prepare("SELECT * FROM empresas WHERE id = ?").get(empresaId);

    // Vincula TODOS os users ativos como membros (admin/operador/visualizador) conforme sua role global
    const users = db.prepare("SELECT id, role FROM users WHERE ativo = 1").all();
    for (const u of users) {
      const papel = u.role === "admin" ? "admin" : u.role === "operador" ? "operador" : "visualizador";
      db.prepare(`
        INSERT INTO empresa_users (empresa_id, user_id, papel, ativo)
        VALUES (?, ?, ?, 1)
      `).run(empresaId, u.id, papel);
    }
    log(`  + empresa '${empresa.nome}' criada (id=${empresaId}) e ${users.length} usuário(s) vinculado(s)`);
  } else {
    empresaId = empresa.id;
    log(`empresa padrão existente: id=${empresaId} nome='${empresa.nome}'`);
  }

  // 2) Conta documents sem empresa_id
  const orphans = db.prepare("SELECT id, xml_path FROM documents WHERE empresa_id IS NULL OR empresa_id = 0").all();
  if (!orphans.length) {
    log("nenhum documento sem empresa — migração de dados não necessária");
  } else {
    // Backup antes de mexer
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
      const backupPath = path.join(BACKUP_DIR, `app.db.antes-tenant-${stamp}.bak`);
      log(`gerando backup em ${backupPath}...`);
      try {
        const DB_PATH = path.join(DATA_DIR, "app.db");
        const src = new DatabaseSync(DB_PATH, { readOnly: true });
        src.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
        src.close();
        log("  backup OK");
      } catch (e) {
        log("  AVISO: backup falhou: " + e.message + " — abortando");
        return;
      }
    } catch (e) {
      log("AVISO: não foi possível preparar pasta de backup: " + e.message);
    }

    log(`atribuindo ${orphans.length} documento(s) à empresa ${empresaId}...`);

    // Cria pasta da empresa
    const empDir = path.join(XML_DIR, `empresa_${empresaId}`);
    fs.mkdirSync(empDir, { recursive: true });

    // node:sqlite não tem db.transaction(fn) — usar BEGIN/COMMIT/ROLLBACK manual
    db.exec("BEGIN");
    try {
      let moved = 0, kept = 0;
      for (const d of orphans) {
        const oldPath = path.join(XML_DIR, d.xml_path);
        // Tenta mover o arquivo
        const fname = path.basename(d.xml_path);
        const newRel = `empresa_${empresaId}/${fname}`;
        const newPath = path.join(XML_DIR, newRel);
        try {
          if (fs.existsSync(oldPath)) {
            // Se destino já existe, não sobrescreve — gera nome único
            let target = newPath;
            if (fs.existsSync(target)) {
              const stamp = Date.now();
              target = path.join(XML_DIR, `empresa_${empresaId}`, `${path.parse(fname).name}-${stamp}${path.extname(fname)}`);
            }
            fs.renameSync(oldPath, target);
            const finalRel = path.relative(XML_DIR, target);
            db.prepare("UPDATE documents SET empresa_id = ?, xml_path = ? WHERE id = ?").run(empresaId, finalRel, d.id);
            moved++;
          } else {
            // XML não está no disco (legado): atualiza só o empresa_id
            db.prepare("UPDATE documents SET empresa_id = ? WHERE id = ?").run(empresaId, d.id);
            kept++;
          }
        } catch (e) {
          log(`  erro movendo doc id=${d.id}: ${e.message}`);
        }
      }
      db.exec("COMMIT");
      log(`  + ${moved} XML(s) movido(s), ${kept} registro(s) só com empresa_id setada`);
    } catch (e) {
      db.exec("ROLLBACK");
      log("ERRO na migração: " + e.message);
      throw e;
    }
  }

  // 3) Garante que o admin global (users.role=admin) tem last_empresa_id e está com sessão ativa
  const admins = db.prepare("SELECT id, last_empresa_id FROM users WHERE role = 'admin' AND ativo = 1").all();
  for (const a of admins) {
    if (!a.last_empresa_id) {
      db.prepare("UPDATE users SET last_empresa_id = ? WHERE id = ?").run(empresaId, a.id);
      log(`  + admin id=${a.id} agora tem last_empresa_id=${empresaId}`);
    }
    // Vincula se por algum motivo não estiver
    const m = db.prepare("SELECT id FROM empresa_users WHERE empresa_id = ? AND user_id = ?").get(empresaId, a.id);
    if (!m) {
      db.prepare(`INSERT INTO empresa_users (empresa_id, user_id, papel, ativo) VALUES (?, ?, 'admin', 1)`).run(empresaId, a.id);
      log(`  + admin id=${a.id} vinculado à empresa ${empresaId}`);
    }
  }

  // 4) Marca TODAS as sessões ativas com empresa_ativa_id da empresa padrão
  // (para que reinicializar o servidor não quebre a sessão)
  const sessCount = db.prepare("UPDATE sessions SET empresa_ativa_id = ? WHERE empresa_ativa_id IS NULL").run(empresaId).changes;
  if (sessCount) log(`  + ${sessCount} sessão(ões) atualizada(s) com empresa ativa`);

  log("migração concluída ✓");
}

main().catch((e) => {
  console.error("[migrate] FALHOU:", e);
  process.exit(1);
});
