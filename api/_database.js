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
        onboarding_completed_at TIMESTAMPTZ,
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
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data BYTEA;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS empresa_ativa_id BIGINT;
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'password';
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
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
      ALTER TABLE empresas ADD COLUMN IF NOT EXISTS requer_certificado BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE empresas ADD COLUMN IF NOT EXISTS empresa_matriz_id BIGINT REFERENCES empresas(id);
      ALTER TABLE empresas ADD COLUMN IF NOT EXISTS im TEXT;
      UPDATE empresas SET requer_certificado=TRUE WHERE cnpj='03857930000154';
      CREATE TABLE IF NOT EXISTS empresa_alert_emails (
        id BIGSERIAL PRIMARY KEY,
        empresa_id BIGINT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(empresa_id,email)
      );
      CREATE TABLE IF NOT EXISTS empresa_module_config (
        empresa_id BIGINT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        modulo TEXT NOT NULL,
        configuracao JSONB NOT NULL DEFAULT '{}'::jsonb,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(empresa_id,modulo)
      );
      INSERT INTO empresas(cnpj,nome,nome_fantasia,ie,im,ambiente,ativo,requer_certificado)
      VALUES
        ('61779867000181','ALM LOG','ALM LOG',NULL,'4BP6493','producao',TRUE,FALSE),
        ('11554415000123','ANG Participações','ANG Participações',NULL,'4980807','producao',TRUE,FALSE),
        ('11613649000102','Intecom Participações','Intecom Participações',NULL,'4578023','producao',TRUE,FALSE),
        ('03857930000154','INTECOM SERVICOS DE LOGISTICA LTDA','Intecom Serviços','206256630112','4512683','producao',TRUE,TRUE),
        ('10761960000128','IW Serviços','IW Serviços','206274460117','4540569','producao',TRUE,FALSE),
        ('12142391000168','SP Empreendimentos','SP Empreendimentos',NULL,'4625238','producao',TRUE,FALSE)
      ON CONFLICT(cnpj) DO UPDATE SET nome=EXCLUDED.nome,nome_fantasia=EXCLUDED.nome_fantasia,
        ie=EXCLUDED.ie,im=EXCLUDED.im,requer_certificado=EXCLUDED.requer_certificado;
      INSERT INTO empresas(cnpj,nome,nome_fantasia,ie,im,ambiente,ativo,empresa_matriz_id)
      SELECT v.cnpj,v.nome,v.nome,v.ie,v.im,'producao',TRUE,m.id
      FROM empresas m CROSS JOIN (VALUES
        ('03857930000901','Intecom Betim','0032136030191','1644650011'),
        ('03857930000740','Intecom Cajamar','241097223118','15861'),
        ('03857930001207','Intecom Conde I','164001085','20203113'),
        ('03857930001398','Intecom Extrema','0032136030272','0017760'),
        ('03857930001479','Intecom Itapoá','262714132','40908'),
        ('03857930000405','Intecom Conde II','161617727','20263671')
      ) AS v(cnpj,nome,ie,im)
      WHERE m.cnpj='03857930000154'
      ON CONFLICT(cnpj) DO UPDATE SET nome=EXCLUDED.nome,nome_fantasia=EXCLUDED.nome_fantasia,
        ie=EXCLUDED.ie,im=EXCLUDED.im,empresa_matriz_id=EXCLUDED.empresa_matriz_id;
      UPDATE empresas filial SET empresa_matriz_id=matriz.id
      FROM empresas matriz
      WHERE matriz.cnpj='03857930000154'
        AND filial.cnpj LIKE '03857930%'
        AND filial.cnpj<>matriz.cnpj;
      CREATE TABLE IF NOT EXISTS empresa_users (
        empresa_id BIGINT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        papel VARCHAR(20) NOT NULL DEFAULT 'operador',
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (empresa_id, user_id)
      );
      ALTER TABLE empresa_users ADD COLUMN IF NOT EXISTS permissoes JSONB NOT NULL DEFAULT
        '{"documentos_visualizar":true,"documentos_incluir":true,"documentos_excluir":false,"cnd_editar":true,"sefaz_consultar":true,"relatorios_gerar":true}'::jsonb;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
      CREATE TABLE IF NOT EXISTS empresa_activity_log (
        id BIGSERIAL PRIMARY KEY,empresa_id BIGINT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,username TEXT,acao TEXT NOT NULL,
        modulo TEXT NOT NULL,entidade_id TEXT,detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS serie TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS protocolo TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS remetente_doc TEXT;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS destinatario_doc TEXT;
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
      ALTER TABLE user_messages ADD COLUMN IF NOT EXISTS attachment_data BYTEA;
      ALTER TABLE user_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
      ALTER TABLE user_messages ADD COLUMN IF NOT EXISTS attachment_mime TEXT;
      ALTER TABLE user_messages ADD COLUMN IF NOT EXISTS attachment_size INTEGER;
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
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS empresa_id BIGINT REFERENCES empresas(id) ON DELETE CASCADE;
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS pdf_data BYTEA;
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS pdf_name TEXT;
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS alerta_modo TEXT DEFAULT 'dias';
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS alerta_dias INTEGER DEFAULT 10;
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS alerta_dia_semana INTEGER;
      ALTER TABLE certidoes ADD COLUMN IF NOT EXISTS alerta_dia_mes INTEGER;
      CREATE TABLE IF NOT EXISTS cnd_config (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        prazo_alerta INTEGER NOT NULL DEFAULT 10,
        alertas_ativos BOOLEAN NOT NULL DEFAULT TRUE,
        alerta_vencimento BOOLEAN NOT NULL DEFAULT TRUE,
        alerta_vencidas BOOLEAN NOT NULL DEFAULT TRUE,
        alerta_positivas BOOLEAN NOT NULL DEFAULT TRUE,
        remetente TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO cnd_config(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
      CREATE TABLE IF NOT EXISTS cnd_destinatarios (
        id BIGSERIAL PRIMARY KEY,
        empresa_id BIGINT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(empresa_id,email)
      );
      CREATE TABLE IF NOT EXISTS sefaz_sync_state (
        empresa_id BIGINT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
        ult_nsu TEXT NOT NULL DEFAULT '0',
        max_nsu TEXT NOT NULL DEFAULT '0',
        locked_until TIMESTAMPTZ,
        last_status TEXT,
        last_error TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sefaz_key_query_log (
        id BIGSERIAL PRIMARY KEY,
        empresa_id BIGINT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
        chave TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS sefaz_key_query_rate_idx
        ON sefaz_key_query_log(empresa_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS empresa_certificados (
        empresa_id BIGINT PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
        encrypted_payload BYTEA NOT NULL,
        arquivo_nome TEXT,
        titular TEXT,
        cnpj TEXT,
        validade_inicio TIMESTAMPTZ,
        validade_fim TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO cnd_destinatarios(empresa_id,email)
      SELECT id,v.email FROM empresas CROSS JOIN (VALUES
        ('raul.guilherme25@gmail.com'),('thiagocordeirodantass@gmail.com')
      ) v(email) WHERE cnpj='03857930000154'
      ON CONFLICT(empresa_id,email) DO NOTHING;
    `);
  }
  return schemaReady;
}
