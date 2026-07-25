import { ensureSchema, pool } from "../_database.js";

export default async function handler(request, response) {
  try {
    await ensureSchema();
    const id = Number(request.query.id);
    if (!Number.isInteger(id))
      return response.status(400).json({ error: "Empresa inválida" });
    if (request.method === "GET") {
      const result = await pool.query("SELECT * FROM empresas WHERE id = $1", [
        id,
      ]);
      if (!result.rowCount)
        return response.status(404).json({ error: "Empresa não encontrada" });
      return response.json(result.rows[0]);
    }
    if (request.method === "PUT") {
      const data = request.body || {};
      const result = await pool.query(
        `UPDATE empresas SET
           nome = COALESCE($2, nome),
           nome_fantasia = COALESCE($3, nome_fantasia),
           ativo = COALESCE($4, ativo),
           updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id, data.nome || null, data.nome_fantasia || null, data.ativo ?? null],
      );
      if (!result.rowCount)
        return response.status(404).json({ error: "Empresa não encontrada" });
      return response.json(result.rows[0]);
    }
    return response.status(405).json({ error: "Método não permitido" });
  } catch (error) {
    console.error("empresa error", error);
    return response.status(500).json({ error: "Erro interno" });
  }
}
