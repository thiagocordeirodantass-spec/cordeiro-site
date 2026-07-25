import { ensureSchema, pool } from "../../_database.js";

export default async function handler(request, response) {
  if (request.method !== "POST")
    return response.status(405).json({ error: "Método não permitido" });
  try {
    await ensureSchema();
    const id = Number(request.query.id);
    const sid = String(request.headers.cookie || "").match(
      /(?:^|;\s*)sid=([^;]+)/,
    )?.[1];
    if (!sid || !Number.isInteger(id))
      return response.status(400).json({ error: "Sessão ou empresa inválida" });

    const sessionId = decodeURIComponent(sid);
    const session = await pool.query(
      `SELECT s.user_id,s.auth_method,u.role FROM sessions s
       JOIN users u ON u.id=s.user_id
       WHERE s.id=$1 AND s.expires_at>NOW()`,
      [sessionId],
    );
    if (!session.rowCount)
      return response.status(401).json({ error: "Não autenticado" });

    const company = await pool.query(
      "SELECT * FROM empresas WHERE id=$1 AND ativo=TRUE",
      [id],
    );
    if (!company.rowCount)
      return response.status(404).json({ error: "Empresa não encontrada" });
    const user = session.rows[0];
    if (company.rows[0].requer_certificado && user.auth_method !== "certificate")
      return response.status(403).json({
        error: "A INTECOM somente pode ser acessada com certificado digital A1",
      });
    if (user.role !== "admin") {
      const membership = await pool.query(
        `SELECT 1 FROM empresa_users
         WHERE empresa_id=$1 AND user_id=$2 AND ativo=TRUE`,
        [id, user.user_id],
      );
      if (!membership.rowCount)
        return response.status(403).json({ error: "Sem acesso a essa empresa" });
    }

    await pool.query("UPDATE sessions SET empresa_ativa_id=$1 WHERE id=$2", [
      id,
      sessionId,
    ]);
    return response.json({ ok: true, empresa: company.rows[0] });
  } catch (error) {
    console.error("ativar empresa error", error);
    return response.status(500).json({ error: "Erro ao trocar de empresa" });
  }
}
