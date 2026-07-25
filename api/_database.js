import pg from "pg";

const connectionString =
  process.env.ARMAZENAR_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada");
}

export const pool =
  globalThis.__cordeiroPool ||
  new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 20_000,
  });

globalThis.__cordeiroPool = pool;

let schemaReady;
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(30) NOT NULL UNIQUE,
        nome VARCHAR(120) NOT NULL,
        email VARCHAR(254) UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'operador',
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        primeiro_login BOOLEAN NOT NULL DEFAULT FALSE,
        ultimo_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS email_verifications (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(254) NOT NULL,
        username VARCHAR(30) NOT NULL,
        nome VARCHAR(120) NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        codigo VARCHAR(6) NOT NULL,
        tentativas INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }
  return schemaReady;
}
