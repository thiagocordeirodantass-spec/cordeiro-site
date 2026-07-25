import crypto from "node:crypto";
import { ensureSchema, pool } from "./_database.js";

function parts(request) {
  const value = request.query.route;
  return Array.isArray(value) ? value : String(value || "").split("/").filter(Boolean);
}
function token(request) {
  const match = String(request.headers.cookie || "").match(/(?:^|;\s*)sid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
async function authenticated(request) {
  const sid = token(request);
  if (!sid) return null;
  const result = await pool.query(
    `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.id=$1 AND s.expires_at>NOW() AND u.ativo=TRUE`,
    [sid],
  );
  return result.rows[0] || null;
}
function hash(password) {
  const salt = crypto.randomBytes(16);
  return {
    salt: salt.toString("hex"),
    hash: crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex"),
  };
}
function feedback(row) {
  return {
    id: Number(row.id), userId: Number(row.user_id),
    username: row.anonimo ? "Anônimo" : row.username,
    categoria: row.categoria, assunto: row.assunto, mensagem: row.mensagem,
    anonimo: Boolean(row.anonimo), status: row.status, resposta: row.resposta,
    respondidoPor: row.respondido_por, respondidoEm: row.respondido_em,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export default async function handler(request, response) {
  try {
    await ensureSchema();
    const route = parts(request);

    if (route[0] === "news" && request.method === "GET")
      return response.json({ externos: [], curadas: [] });

    const user = await authenticated(request);
    if (!user) return response.status(401).json({ error: "Não autenticado" });

    if (route[0] === "users") {
      if (user.role !== "admin")
        return response.status(403).json({ error: "Acesso restrito" });
      if (route.length === 1 && request.method === "GET") {
        const result = await pool.query(
          `SELECT id,username,nome,email,role,ativo,primeiro_login,ultimo_login,created_at
             FROM users ORDER BY nome,username`,
        );
        return response.json({ users: result.rows });
      }
      if (route.length === 1 && request.method === "POST") {
        const data = request.body || {};
        if (!data.username || !data.nome)
          return response.status(400).json({ error: "Nome e usuário obrigatórios" });
        const password = `Cord@${crypto.randomBytes(6).toString("hex")}`;
        const secret = hash(password);
        const result = await pool.query(
          `INSERT INTO users
            (username,nome,email,password_hash,password_salt,role,ativo,primeiro_login)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,TRUE) RETURNING id,username,nome,email,role,ativo`,
          [data.username, data.nome, data.email || null, secret.hash, secret.salt, data.role || "operador"],
        );
        if (data.empresaId)
          await pool.query(
            `INSERT INTO empresa_users(empresa_id,user_id,papel) VALUES($1,$2,$3)
             ON CONFLICT(empresa_id,user_id) DO UPDATE SET ativo=TRUE,papel=EXCLUDED.papel`,
            [data.empresaId, result.rows[0].id, data.role || "operador"],
          );
        return response.json({ user: result.rows[0], senhaTemporaria: password });
      }
      const id = Number(route[1]);
      if (Number.isInteger(id) && route[2] === "reset-password" && request.method === "POST") {
        const password = `Cord@${crypto.randomBytes(6).toString("hex")}`;
        const secret = hash(password);
        await pool.query(
          `UPDATE users SET password_hash=$2,password_salt=$3,primeiro_login=TRUE WHERE id=$1`,
          [id, secret.hash, secret.salt],
        );
        await pool.query("DELETE FROM sessions WHERE user_id=$1", [id]);
        return response.json({ ok: true, senhaTemporaria: password });
      }
      if (Number.isInteger(id) && request.method === "PUT") {
        const data = request.body || {};
        const result = await pool.query(
          `UPDATE users SET nome=COALESCE($2,nome),email=COALESCE($3,email),
             role=COALESCE($4,role),ativo=COALESCE($5,ativo)
           WHERE id=$1 RETURNING id,username,nome,email,role,ativo,ultimo_login`,
          [id, data.nome || null, data.email || null, data.role || null, data.ativo ?? null],
        );
        return response.json(result.rows[0]);
      }
    }

    if (route[0] === "feedback") {
      if (route.length === 1 && request.method === "POST") {
        const data = request.body || {};
        if (!String(data.mensagem || "").trim())
          return response.status(400).json({ error: "Mensagem obrigatória" });
        const result = await pool.query(
          `INSERT INTO feedback(user_id,username,categoria,assunto,mensagem,anonimo)
           VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
          [user.id,user.username,data.categoria || "outro",data.assunto || null,
           String(data.mensagem).trim().slice(0,4000),Boolean(data.anonimo)],
        );
        return response.json({ ok: true, feedback: feedback(result.rows[0]) });
      }
      if (request.method === "GET" && (route[1] === "me" || user.role !== "admin")) {
        const result = await pool.query(
          "SELECT * FROM feedback WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200",
          [user.id],
        );
        return response.json(result.rows.map(feedback));
      }
      if (route.length === 1 && request.method === "GET") {
        const result = await pool.query("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 500");
        return response.json(result.rows.map(feedback));
      }
      const id = Number(route[1]);
      if (user.role === "admin" && Number.isInteger(id) && request.method === "PATCH") {
        const data = request.body || {};
        const result = await pool.query(
          `UPDATE feedback SET status=COALESCE($2,status),resposta=COALESCE($3,resposta),
             respondido_por=CASE WHEN $3::text IS NULL THEN respondido_por ELSE $4 END,
             respondido_em=CASE WHEN $3::text IS NULL THEN respondido_em ELSE NOW() END,
             updated_at=NOW() WHERE id=$1 RETURNING *`,
          [id,data.status || null,data.resposta || null,user.username],
        );
        return response.json({ ok: true, feedback: feedback(result.rows[0]) });
      }
      if (user.role === "admin" && Number.isInteger(id) && request.method === "DELETE") {
        await pool.query("DELETE FROM feedback WHERE id=$1", [id]);
        return response.json({ ok: true });
      }
    }

    if (route[0] === "messages") {
      if (route[1] === "users" && request.method === "GET") {
        const result = await pool.query(
          `SELECT u.id,u.username,u.nome,u.email,u.role,
             COUNT(m.id) FILTER(WHERE m.read_at IS NULL)::int AS unread
           FROM users u LEFT JOIN user_messages m
             ON m.sender_id=u.id AND m.recipient_id=$1
           WHERE u.ativo=TRUE AND u.id<>$1 GROUP BY u.id ORDER BY unread DESC,u.nome`,
          [user.id],
        );
        return response.json(result.rows);
      }
      if (route[1] === "thread" && request.method === "GET") {
        const other = Number(route[2]);
        await pool.query(
          "UPDATE user_messages SET read_at=NOW() WHERE sender_id=$1 AND recipient_id=$2 AND read_at IS NULL",
          [other,user.id],
        );
        const result = await pool.query(
          `SELECT * FROM user_messages WHERE
           (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)
           ORDER BY id LIMIT 300`,
          [user.id,other],
        );
        return response.json(result.rows);
      }
      if (route.length === 1 && request.method === "POST") {
        const recipient = Number(request.body?.recipientId);
        const content = String(request.body?.content || "").trim().slice(0,3000);
        if (!recipient || !content)
          return response.status(400).json({ error: "Destinatário e mensagem obrigatórios" });
        const result = await pool.query(
          `INSERT INTO user_messages(sender_id,recipient_id,content)
           VALUES($1,$2,$3) RETURNING *`,
          [user.id,recipient,content],
        );
        return response.json(result.rows[0]);
      }
    }

    if (route[0] === "docs" && request.method === "GET") {
      if (route.length === 1) {
        const result = await pool.query(
          "SELECT * FROM documents ORDER BY data_emissao DESC NULLS LAST,id DESC LIMIT 500",
        );
        return response.json({ items: result.rows, total: result.rowCount });
      }
      const result = await pool.query("SELECT * FROM documents WHERE id=$1", [Number(route[1])]);
      if (!result.rowCount) return response.status(404).json({ error: "Documento não encontrado" });
      return response.json(result.rows[0]);
    }

    if (route[0] === "sefaz" || route[0] === "meudanfe" || route[0] === "consulta")
      return response.status(503).json({
        error: "Integração indisponível no ambiente serverless; somente consulta será habilitada após configurar o provedor.",
      });

    return response.status(404).json({ error: "Endpoint ainda não migrado" });
  } catch (error) {
    console.error("api error", error);
    return response.status(error.code === "23505" ? 400 : 500).json({
      error: error.code === "23505" ? "Registro já cadastrado" : "Erro interno da API",
    });
  }
}
