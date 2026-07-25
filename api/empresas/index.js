import { ensureSchema, pool } from "../_database.js";

export default async function handler(request, response) {
  try {
    await ensureSchema();
    if (request.method === "GET") {
      const result = await pool.query(
        "SELECT * FROM empresas ORDER BY ativo DESC, nome",
      );
      return response.json({ empresas: result.rows });
    }
    if (request.method === "POST") {
      const data = request.body || {};
      if (!data.nome)
        return response.status(400).json({ error: "Razão social obrigatória" });
      const result = await pool.query(
        `INSERT INTO empresas
          (cnpj, nome, nome_fantasia, ie, regime_tributario, ambiente)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          String(data.cnpj || "").replace(/\D/g, "") || null,
          data.nome,
          data.nome_fantasia || null,
          data.ie || null,
          data.regime_tributario || null,
          data.ambiente || "producao",
        ],
      );
      const sid = String(request.headers.cookie || "").match(/(?:^|;\s*)sid=([^;]+)/)?.[1];
      if (sid) {
        const current = await pool.query(
          `SELECT user_id FROM sessions WHERE id=$1 AND expires_at>NOW()`,
          [decodeURIComponent(sid)],
        );
        if (current.rowCount) {
          await pool.query(
            `INSERT INTO empresa_users(empresa_id,user_id,papel)
             VALUES($1,$2,'admin') ON CONFLICT(empresa_id,user_id)
             DO UPDATE SET ativo=TRUE,papel='admin'`,
            [result.rows[0].id,current.rows[0].user_id],
          );
          await pool.query(
            "UPDATE sessions SET empresa_ativa_id=$1 WHERE id=$2",
            [result.rows[0].id,decodeURIComponent(sid)],
          );
        }
      }
      return response.status(201).json(result.rows[0]);
    }
    return response.status(405).json({ error: "Método não permitido" });
  } catch (error) {
    console.error("empresas error", error);
    return response
      .status(error.code === "23505" ? 400 : 500)
      .json({ error: error.code === "23505" ? "CNPJ já cadastrado" : "Erro interno" });
  }
}
