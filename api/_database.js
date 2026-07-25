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
        cargo TEXT,
        area_atuacao TEXT,
        bio TEXT,
        linkedin_url TEXT,
        instagram_url TEXT,
        website_url TEXT,
        telefone TEXT,
        preferencias JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS cargo TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS area_atuacao TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telefone TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS preferencias JSONB NOT NULL DEFAULT '{}'::jsonb;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS empresa_ativa_id BIGINT;
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
      CREATE TABLE IF NOT EXISTS empresas (
        id BIGSERIAL PRIMARY KEY,
        cnpj VARCHAR(14) UNIQUE,
        nome VARCHAR(160) NOT NULL,
        nome_fantasia VARCHAR(160),
        ie VARCHAR(30),
        regime_tributario VARCHAR(30),
        ambiente VARCHAR(20) NOT NULL DEFAULT 'producao',
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS empresa_users (
        empresa_id BIGINT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        papel VARCHAR(20) NOT NULL DEFAULT 'operador',
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (empresa_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS documents (
        id BIGSERIAL PRIMARY KEY,
        empresa_id BIGINT REFERENCES empresas(id) ON DELETE SET NULL,
        kind VARCHAR(10),
        chave VARCHAR(44),
        numero TEXT,
        data_emissao TIMESTAMPTZ,
        valor_total NUMERIC(18,2) NOT NULL DEFAULT 0,
        status VARCHAR(30),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS documents_empresa_idx ON documents(empresa_id);
      CREATE INDEX IF NOT EXISTS documents_emissao_idx ON documents(data_emissao);
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS xml_data TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS source TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS remetente_nome TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS destinatario_nome TEXT;
      CREATE TABLE IF NOT EXISTS feedback (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        categoria TEXT NOT NULL DEFAULT 'outro',
        assunto TEXT,
        mensagem TEXT NOT NULL,
        anonimo BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'aberto',
        resposta TEXT,
        respondido_por TEXT,
        respondido_em TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_messages (
        id BIGSERIAL PRIMARY KEY,
        sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS messages_pair_idx
        ON user_messages(sender_id, recipient_id, created_at);
      CREATE TABLE IF NOT EXISTS certidoes (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        tipo TEXT, orgao TEXT, numero TEXT, cnpj TEXT,
        razao_social TEXT, situacao TEXT, emitida_em DATE, valida_ate DATE,
        observacoes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'negativa';
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS data_emissao DATE;
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS data_validade DATE;
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS numero_certidao TEXT;
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS empresa_nome TEXT;
    `);
  }
  return schemaReady;
}
