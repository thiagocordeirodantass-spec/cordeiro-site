// =============================================================================
//  db/seed.js — cria usuário admin padrão se a tabela users estiver vazia
//  -----------------------------------------------------------------------------
//  Gera uma senha temporária aleatória e a imprime UMA VEZ no console.
//  O usuário é forçado a trocar a senha no primeiro login (campo primeiro_login=1).
//  Cria também uma empresa padrão "Minha Empresa" e vincula o admin a ela.
// =============================================================================
import crypto from "crypto";
import { db } from "./index.js";
import { hashPassword } from "../services/auth.service.js";

export function runSeed(logger = console.log) {
  const total = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (total > 0) {
    return { created: false };
  }

  // senha temporária de 12 chars (alfanumérica)
  const tempPassword = crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x").slice(0, 12);
  const { hash, salt } = hashPassword(tempPassword);

  const stmt = db.prepare(`
    INSERT INTO users (username, nome, email, password_hash, password_salt, role, ativo, primeiro_login)
    VALUES (?, ?, ?, ?, ?, 'admin', 1, 1)
  `);
  const info = stmt.run("admin", "Administrador", null, hash, salt);
  const adminId = Number(info.lastInsertRowid);

  // Cria empresa padrão "Minha Empresa" e vincula o admin
  try {
    const totalEmp = db.prepare("SELECT COUNT(*) as c FROM empresas").get().c;
    if (totalEmp === 0) {
      const empInfo = db.prepare(`
        INSERT INTO empresas (cnpj, nome, ambiente, ativo)
        VALUES ('00000000000000', 'Minha Empresa', 'homologacao', 1)
      `).run();
      const empId = Number(empInfo.lastInsertRowid);
      db.prepare(`
        INSERT INTO empresa_users (empresa_id, user_id, papel, ativo)
        VALUES (?, ?, 'admin', 1)
      `).run(empId, adminId);
      logger("  + empresa padrão 'Minha Empresa' criada e admin vinculado");
    }
  } catch (e) {
    logger("[seed] falha ao criar empresa padrão: " + e.message);
  }

  logger("");
  logger("=================================================================");
  logger("  USUÁRIO ADMIN CRIADO (PRIMEIRO ACESSO)");
  logger("  ----------------------------------------------------------------");
  logger(`  username: admin`);
  logger(`  senha temporária: ${tempPassword}`);
  logger("  Você será obrigado a trocar essa senha no primeiro login.");
  logger("  Guarde em local seguro — ela não será exibida novamente.");
  logger("=================================================================");
  logger("");

  return { created: true, id: adminId, tempPassword };
}
