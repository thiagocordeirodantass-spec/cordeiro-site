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
           ie = COALESCE($4, ie), im = COALESCE($5, im),
           regime_tributario = COALESCE($6, regime_tributario),
           ambiente = COALESCE($7, ambiente),
           ativo = COALESCE($8, ativo),
           updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id,data.nome||null,data.nome_fantasia||null,data.ie||null,data.im||null,
         data.regime_tributario||null,data.ambiente||null,data.ativo??null],
      );
      if (!result.rowCount)
        return response.status(404).json({ error: "Empresa não encontrada" });
      return response.json(result.rows[0]);
    }
    if(request.method==="DELETE"){
      const children=await pool.query("SELECT COUNT(*)::int total FROM empresas WHERE empresa_matriz_id=$1",[id]);
      if(children.rows[0].total)return response.status(409).json({error:"Exclua ou mova as filiais antes de excluir a matriz"});
      await pool.query("DELETE FROM empresas WHERE id=$1",[id]);
      return response.json({ok:true});
    }
    return response.status(405).json({ error: "Método não permitido" });
  } catch (error) {
    console.error("empresa error", error);
    return response.status(500).json({ error: "Erro interno" });
  }
}
