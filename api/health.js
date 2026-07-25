import pg from "pg";

const connectionString =
  process.env.ARMAZENAR_DATABASE_URL || process.env.DATABASE_URL;

const pool = connectionString
  ? new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 2,
    })
  : null;

export default async function handler(_request, response) {
  if (!pool) {
    return response.status(503).json({
      ok: false,
      database: false,
      error: "DATABASE_URL não configurada",
    });
  }

  try {
    await pool.query("select 1");
    return response.status(200).json({
      ok: true,
      database: true,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(503).json({
      ok: false,
      database: false,
      error: "Falha ao conectar ao banco",
    });
  }
}
