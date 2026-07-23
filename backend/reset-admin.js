// =============================================================================
//  reset-admin.js — redefine a senha do usuário admin
//  Uso: node reset-admin.js [nova_senha]  (padrão: cordeiro123)
// =============================================================================
import { db } from "./db/index.js";
import { hashPassword } from "./services/auth.service.js";

const newPassword = process.argv[2] || "cordeiro123";
const { hash, salt } = hashPassword(newPassword);

const result = db
  .prepare(
    "UPDATE users SET password_hash = ?, password_salt = ?, primeiro_login = 0 WHERE username = 'admin'"
  )
  .run(hash, salt);

if (result.changes === 0) {
  console.error("Nenhum usuário 'admin' encontrado. Rode o backend uma vez para o seed criar.");
  process.exit(1);
}

console.log("=================================");
console.log("  Senha do admin redefinida");
console.log(`  username: admin`);
console.log(`  senha:    ${newPassword}`);
console.log("=================================");
