import crypto from "node:crypto";
import { ensureSchema, pool } from "../_database.js";

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export default async function handler(request, response) {
  if (
    request.method !== "POST" ||
    !process.env.ADMIN_RESET_SECRET ||
    request.headers.authorization !== `Bearer ${process.env.ADMIN_RESET_SECRET}`
  ) {
    return response.status(404).json({ error: "Endpoint não encontrado" });
  }

  const password = String(request.body?.password || "");
  if (password.length < 12)
    return response.status(400).json({ error: "Senha temporária inválida" });

  await ensureSchema();
  const { salt, hash } = hashPassword(password);
  const accounts = [
    { username: "admin", nome: "Administrador", email: null },
    {
      username: "MecXiL",
      nome: "Raul Guilherme Rodrigues da Silva",
      email: "raul.guilherme25@gmail.com",
    },
  ];

  for (const account of accounts) {
    await pool.query(
      `INSERT INTO users
        (username, nome, email, password_hash, password_salt, role, ativo, primeiro_login)
       VALUES ($1, $2, $3, $4, $5, 'admin', TRUE, TRUE)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         password_salt = EXCLUDED.password_salt,
         role = 'admin',
         ativo = TRUE,
         primeiro_login = TRUE`,
      [account.username, account.nome, account.email, hash, salt],
    );
  }

  await pool.query(
    "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = ANY($1))",
    [["admin", "MecXiL"]],
  );
  return response.json({ ok: true, updated: accounts.map((item) => item.username) });
}
