import crypto from "node:crypto";
import { ensureSchema, pool } from "../_database.js";

const COOKIE = "sid";
const SESSION_HOURS = 8;

function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

function validPassword(password, salt, expectedHex) {
  try {
    const actual = hashPassword(password, salt).hash;
    return crypto.timingSafeEqual(
      Buffer.from(actual, "hex"),
      Buffer.from(expectedHex, "hex"),
    );
  } catch {
    return false;
  }
}

function cookie(request, name) {
  const raw = request.headers.cookie || "";
  const entry = raw
    .split(";")
    .map((item) => item.trim().split("="))
    .find(([key]) => key === name);
  return entry ? decodeURIComponent(entry.slice(1).join("=")) : null;
}

function publicUser(user) {
  return {
    id: Number(user.id),
    username: user.username,
    nome: user.nome,
    email: user.email,
    role: user.role,
    primeiro_login: Boolean(user.primeiro_login),
    ultimo_login: user.ultimo_login,
    is_super_admin: user.role === "admin",
    memberships: [],
    empresa_ativa_id: null,
    empresa_ativa: null,
    preferencias: {},
  };
}

async function currentUser(request) {
  const token = cookie(request, COOKIE);
  if (!token) return null;
  const result = await pool.query(
    `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > NOW() AND u.ativo = TRUE`,
    [token],
  );
  return result.rows[0] || null;
}

function setSession(response, token) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`,
  );
}

async function createSession(request, response, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      token,
      userId,
      expiresAt,
      request.headers["x-forwarded-for"] || null,
      request.headers["user-agent"] || null,
    ],
  );
  setSession(response, token);
  return expiresAt.toISOString();
}

export default async function handler(request, response) {
  try {
    await ensureSchema();
    const action = request.query.action;

    if (action === "login" && request.method === "POST") {
      const username = String(request.body?.username || "").trim();
      const password = String(request.body?.password || "");
      const result = await pool.query(
        "SELECT * FROM users WHERE username = $1 AND ativo = TRUE",
        [username],
      );
      const user = result.rows[0];
      if (!user || !validPassword(password, user.password_salt, user.password_hash)) {
        return response.status(401).json({ error: "Usuário ou senha inválidos" });
      }
      const expiresAt = await createSession(request, response, user.id);
      await pool.query("UPDATE users SET ultimo_login = NOW() WHERE id = $1", [
        user.id,
      ]);
      return response.json({ ok: true, user: publicUser(user), expiresAt });
    }

    if (action === "me" && request.method === "GET") {
      const user = await currentUser(request);
      if (!user)
        return response.status(401).json({ error: "Não autenticado" });
      return response.json({ user: publicUser(user) });
    }

    if (action === "logout" && request.method === "POST") {
      const token = cookie(request, COOKIE);
      if (token) await pool.query("DELETE FROM sessions WHERE id = $1", [token]);
      response.setHeader(
        "Set-Cookie",
        `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      );
      return response.json({ ok: true });
    }

    if (action === "register-start" && request.method === "POST") {
      const { nome, email, username, password } = request.body || {};
      if (!nome || !email || !username || !password)
        return response.status(400).json({ error: "Preencha todos os campos" });
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username))
        return response.status(400).json({ error: "Usuário inválido" });
      if (String(password).length < 4)
        return response.status(400).json({ error: "Senha muito curta" });
      const exists = await pool.query(
        "SELECT 1 FROM users WHERE username = $1 OR email = $2",
        [username, email],
      );
      if (exists.rowCount)
        return response.status(400).json({ error: "Usuário ou e-mail já cadastrado" });
      const { salt, hash } = hashPassword(String(password));
      const codigo = String(crypto.randomInt(100000, 1000000));
      await pool.query("DELETE FROM email_verifications WHERE email = $1", [
        email,
      ]);
      await pool.query(
        `INSERT INTO email_verifications
          (email, username, nome, password_hash, password_salt, codigo, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '15 minutes')`,
        [email, username, nome, hash, salt, codigo],
      );
      return response.json({
        ok: true,
        codigoDev: codigo,
        mailMethod: "console",
      });
    }

    if (action === "register-verify" && request.method === "POST") {
      const email = String(request.body?.email || "");
      const codigo = String(request.body?.codigo || "");
      const pending = await pool.query(
        `SELECT * FROM email_verifications
          WHERE email = $1 ORDER BY id DESC LIMIT 1`,
        [email],
      );
      const row = pending.rows[0];
      if (!row || row.codigo !== codigo || new Date(row.expires_at) < new Date())
        return response.status(400).json({ error: "Código inválido ou expirado" });
      const count = await pool.query("SELECT COUNT(*)::int AS total FROM users");
      const role = count.rows[0].total === 0 ? "admin" : "operador";
      const inserted = await pool.query(
        `INSERT INTO users
          (username, nome, email, password_hash, password_salt, role)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          row.username,
          row.nome,
          row.email,
          row.password_hash,
          row.password_salt,
          role,
        ],
      );
      await pool.query("DELETE FROM email_verifications WHERE id = $1", [row.id]);
      const user = inserted.rows[0];
      const expiresAt = await createSession(request, response, user.id);
      return response.json({
        ok: true,
        user: publicUser(user),
        expiresAt,
        role,
      });
    }

    return response.status(404).json({ error: "Endpoint não encontrado" });
  } catch (error) {
    console.error("auth error", error);
    return response.status(500).json({ error: "Erro interno de autenticação" });
  }
}
