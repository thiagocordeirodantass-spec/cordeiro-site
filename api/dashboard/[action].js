import { ensureSchema, pool } from "../_database.js";

export default async function handler(request, response) {
  try {
    await ensureSchema();
    const sid = String(request.headers.cookie || "").match(/(?:^|;\s*)sid=([^;]+)/)?.[1];
    const session = sid
      ? await pool.query(
          "SELECT empresa_ativa_id FROM sessions WHERE id=$1 AND expires_at>NOW()",
          [decodeURIComponent(sid)],
        )
      : null;
    if (!session?.rowCount)
      return response.status(401).json({ error: "Não autenticado" });
    const empresaId = session.rows[0].empresa_ativa_id;
    if (request.method !== "GET")
      return response.status(405).json({ error: "Método não permitido" });

    if (request.query.action === "kpis") {
      const result = await pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'autorizado')::int AS autorizados,
               COALESCE(SUM(valor_total), 0)::float8 AS valor_total,
               COUNT(*) FILTER (
                 WHERE date_trunc('month', data_emissao) = date_trunc('month', NOW())
               )::int AS mes_atual
          FROM documents WHERE ($1::bigint IS NULL OR empresa_id=$1)
      `,[empresaId]);
      return response.json(result.rows[0]);
    }

    if (request.query.action === "por-mes") {
      const limit = Math.min(Math.max(Number(request.query.ultimos) || 8, 1), 24);
      const result = await pool.query(
        `SELECT to_char(date_trunc('month', data_emissao), 'MM/YYYY') AS mes,
                COUNT(*)::int AS total,
                COALESCE(SUM(valor_total), 0)::float8 AS valor
           FROM documents
          WHERE data_emissao >= date_trunc('month', NOW()) - (($1 - 1) * INTERVAL '1 month')
            AND ($2::bigint IS NULL OR empresa_id=$2)
          GROUP BY date_trunc('month', data_emissao)
          ORDER BY date_trunc('month', data_emissao)`,
        [limit,empresaId],
      );
      return response.json(result.rows);
    }

    return response.status(404).json({ error: "Endpoint não encontrado" });
  } catch (error) {
    console.error("dashboard error", error);
    return response.status(500).json({ error: "Erro ao carregar dashboard" });
  }
}
