import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { PDFParse } from "pdf-parse";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.resolve(__dirname, "..", "..", "data", "certidoes");
fs.mkdirSync(PDF_DIR, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(file.mimetype === "application/pdf" ? null : new Error("Envie um PDF"), file.mimetype === "application/pdf"),
});

db.exec(`
  CREATE TABLE IF NOT EXISTS certidoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    entidade_tipo TEXT NOT NULL DEFAULT 'empresa',
    entidade_nome TEXT,
    tipo TEXT NOT NULL,
    data_emissao TEXT,
    data_validade TEXT,
    validade_dias INTEGER,
    modo_validade TEXT NOT NULL DEFAULT 'data_direta',
    status TEXT NOT NULL DEFAULT 'negativa',
    numero_certidao TEXT,
    observacoes TEXT,
    pdf_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS certidoes_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certidao_id INTEGER NOT NULL,
    dados TEXT NOT NULL,
    pdf_path TEXT,
    arquivado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_certidoes_empresa ON certidoes(empresa_id, data_validade);
  CREATE TABLE IF NOT EXISTS cnd_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    prazo_alerta INTEGER NOT NULL DEFAULT 10,
    alertas_ativos INTEGER NOT NULL DEFAULT 1,
    alerta_vencimento INTEGER NOT NULL DEFAULT 1,
    alerta_vencidas INTEGER NOT NULL DEFAULT 1,
    alerta_positivas INTEGER NOT NULL DEFAULT 1,
    remetente TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT OR IGNORE INTO cnd_config(id) VALUES(1);
  CREATE TABLE IF NOT EXISTS cnd_destinatarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(empresa_id,email)
  );
`);
for(const [name,type] of [["alerta_modo","TEXT DEFAULT 'dias'"],["alerta_dias","INTEGER DEFAULT 10"],
  ["alerta_dia_semana","INTEGER"],["alerta_dia_mes","INTEGER"]]){
  try{db.exec(`ALTER TABLE certidoes ADD COLUMN ${name} ${type}`)}catch{}
}
const matrizCnd = db.prepare("SELECT id FROM empresas WHERE cnpj='03857930000154'").get();
if (matrizCnd) {
  const insertRecipient=db.prepare("INSERT OR IGNORE INTO cnd_destinatarios(empresa_id,email) VALUES(?,?)");
  insertRecipient.run(matrizCnd.id,"raul.guilherme25@gmail.com");
  insertRecipient.run(matrizCnd.id,"thiagocordeirodantass@gmail.com");
}

const validTypes = new Set(["federal", "estadual", "municipal", "fgts", "cndt", "imobiliario"]);
const validStatuses = new Set(["negativa", "positiva_com_efeitos_de_negativa", "positiva"]);
const tenantId = (req) => req.tenantId || Number(req.query.empresaId || req.body?.empresaId);

function formatCnpj(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function isValidCnpj(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const calculateDigit = (base) => {
    let weight = base.length - 7;
    let sum = 0;
    for (const digit of base) {
      sum += Number(digit) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    calculateDigit(digits.slice(0, 12)) === Number(digits[12]) &&
    calculateDigit(digits.slice(0, 13)) === Number(digits[13])
  );
}

function extractCompanyName(text) {
  const patterns = [
    /(?:RAZÃO SOCIAL|NOME EMPRESARIAL)\s*[:\-]\s*([^\r\n]{3,120})/i,
    /(?:CONTRIBUINTE|INTERESSADO)\s*[:\-]\s*([^\r\n]{3,120})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/\s{2,}.*$/, "")
        .replace(/\bCNPJ\b.*$/i, "")
        .trim()
        .slice(0, 120);
    }
  }
  return "";
}

function archive(row) {
  db.prepare(`
    INSERT INTO certidoes_historico (certidao_id, dados, pdf_path)
    VALUES (?, ?, ?)
  `).run(row.id, JSON.stringify(row), row.pdf_path || null);
}

router.get("/", (req, res) => {
  const empresaId = tenantId(req);
  const where = [], params = [];
  if (empresaId) { where.push("c.empresa_id = ?"); params.push(empresaId); }
  if (req.query.tipo) { where.push("c.tipo = ?"); params.push(req.query.tipo); }
  if (req.query.status) { where.push("c.status = ?"); params.push(req.query.status); }
  const rows = db.prepare(`
    SELECT c.*, e.nome empresa_nome, e.cnpj
    FROM certidoes c JOIN empresas e ON e.id = c.empresa_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY CASE WHEN c.data_validade IS NULL THEN 1 ELSE 0 END, c.data_validade, c.id DESC
  `).all(...params);
  res.json(rows.map((row) => ({
    ...row,
    pdf_url: row.pdf_path ? `/api/certidoes/${row.id}/pdf` : null,
  })));
});

router.get("/stats", (req, res) => {
  const empresaId = tenantId(req);
  const clause = empresaId ? "WHERE empresa_id = ?" : "";
  const params = empresaId ? [empresaId] : [];
  const row = db.prepare(`
    SELECT COUNT(*) total,
      SUM(CASE WHEN date(data_validade) < date('now') THEN 1 ELSE 0 END) vencidas,
      SUM(CASE WHEN date(data_validade) BETWEEN date('now') AND date('now', '+30 day') THEN 1 ELSE 0 END) vencendo,
      SUM(CASE WHEN status = 'negativa' THEN 1 ELSE 0 END) negativas,
      SUM(CASE WHEN status = 'positiva_com_efeitos_de_negativa' THEN 1 ELSE 0 END) com_efeitos,
      SUM(CASE WHEN status = 'positiva' THEN 1 ELSE 0 END) positivas
    FROM certidoes ${clause}
  `).get(...params);
  res.json({
    total: Number(row.total || 0),
    vencidas: Number(row.vencidas || 0),
    vencendo: Number(row.vencendo || 0),
    negativas: Number(row.negativas || 0),
    com_efeitos: Number(row.com_efeitos || 0),
    positivas: Number(row.positivas || 0),
  });
});

router.get("/config", (_req, res) => {
  const config = db.prepare("SELECT * FROM cnd_config WHERE id=1").get();
  const destinatarios = db.prepare(`
    SELECT d.*, e.nome empresa_nome, e.empresa_matriz_id
    FROM cnd_destinatarios d JOIN empresas e ON e.id=d.empresa_id
    ORDER BY d.ativo DESC, e.nome, d.email
  `).all();
  res.json({ config, destinatarios });
});

router.put("/config", (req, res) => {
  const d = req.body || {};
  db.prepare(`UPDATE cnd_config SET prazo_alerta=?,alertas_ativos=?,alerta_vencimento=?,
    alerta_vencidas=?,alerta_positivas=?,remetente=?,updated_at=datetime('now') WHERE id=1`)
    .run(Math.max(1, Math.min(365, Number(d.prazo_alerta || 10))), d.alertas_ativos ? 1 : 0,
      d.alerta_vencimento ? 1 : 0, d.alerta_vencidas ? 1 : 0, d.alerta_positivas ? 1 : 0,
      String(d.remetente || "").trim() || null);
  res.json(db.prepare("SELECT * FROM cnd_config WHERE id=1").get());
});

router.post("/destinatarios", (req, res) => {
  const empresaId = Number(req.body?.empresa_id);
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!empresaId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Empresa e e-mail válido são obrigatórios" });
  const company = db.prepare("SELECT id FROM empresas WHERE id=? AND ativo=1").get(empresaId);
  if (!company) return res.status(404).json({ error: "Empresa ou filial não encontrada" });
  db.prepare(`INSERT INTO cnd_destinatarios(empresa_id,email,ativo) VALUES(?,?,1)
    ON CONFLICT(empresa_id,email) DO UPDATE SET ativo=1`).run(empresaId,email);
  res.json({ ok: true });
});

router.delete("/destinatarios/:id", (req, res) => {
  db.prepare("DELETE FROM cnd_destinatarios WHERE id=?").run(Number(req.params.id));
  res.json({ ok: true });
});

router.post("/enviar-teste", (_req, res) => {
  const count = db.prepare("SELECT COUNT(*) total FROM cnd_destinatarios WHERE ativo=1").get().total;
  if (!count) return res.status(400).json({ error: "Cadastre ao menos um destinatário ativo" });
  res.json({ ok: true, enviados: Number(count), message: "Teste registrado para envio" });
});

router.post("/", (req, res) => {
  const empresaId = tenantId(req);
  const body = req.body || {};
  if (!empresaId) return res.status(400).json({ error: "Empresa é obrigatória" });
  if (!validTypes.has(body.tipo)) return res.status(400).json({ error: "Tipo de certidão inválido" });
  if (!validStatuses.has(body.status)) return res.status(400).json({ error: "Status inválido" });
  let validade = body.dataValidade || null;
  if (body.modoValidade === "dias_apos_emissao" && body.dataEmissao && body.validadeDias) {
    const date = new Date(`${body.dataEmissao}T12:00:00`);
    date.setDate(date.getDate() + Number(body.validadeDias));
    validade = date.toISOString().slice(0, 10);
  }
  const info = db.prepare(`
    INSERT INTO certidoes
      (empresa_id, entidade_tipo, entidade_nome, tipo, data_emissao, data_validade,
       validade_dias, modo_validade, status, numero_certidao, observacoes,
       alerta_modo, alerta_dias, alerta_dia_semana, alerta_dia_mes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    empresaId, body.entidadeTipo || "empresa", body.entidadeNome || null,
    body.tipo, body.dataEmissao || null, validade, body.validadeDias || null,
    body.modoValidade || "data_direta", body.status,
    body.numeroCertidao || null, body.observacoes || null,
    body.alertaModo || "dias", Number(body.alertaDias ?? 10),
    body.alertaDiaSemana ?? null, body.alertaDiaMes ?? null,
  );
  res.json(db.prepare("SELECT * FROM certidoes WHERE id = ?").get(info.lastInsertRowid));
});

router.post("/recognize", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Selecione o PDF da certidão" });
  try {
    const parser = new PDFParse({ data: req.file.buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = String(parsed.text || "").replace(/\s+/g, " ").trim();
    if (text.length < 30)
      return res.status(422).json({ error: "O PDF não possui texto legível. Envie um PDF pesquisável." });
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const cnpjMatch = text.match(/\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}/);
    const cnpj = cnpjMatch?.[0].replace(/\D/g, "") || "";
    let empresaId = tenantId(req);
    let empresaCriada = null;
    if (cnpj) {
      if (!isValidCnpj(cnpj)) {
        return res.status(422).json({
          error: `O CNPJ ${formatCnpj(cnpj)} encontrado no PDF é inválido.`,
        });
      }
      let company = db.prepare(`
        SELECT id FROM empresas
        WHERE REPLACE(REPLACE(REPLACE(cnpj,'.',''),'/',''),'-','') = ?
      `).get(cnpj);
      if (!company) {
        if (req.user?.role !== "admin") {
          return res.status(403).json({
            error: `O CNPJ ${formatCnpj(cnpj)} não está cadastrado. Solicite o cadastro a um administrador.`,
          });
        }
        const extractedName = extractCompanyName(parsed.text || "");
        const companyName = extractedName || `Empresa ${formatCnpj(cnpj)}`;
        const created = db.prepare(`
          INSERT INTO empresas
            (cnpj, nome, nome_fantasia, ambiente, ativo)
          VALUES (?, ?, ?, 'homologacao', 1)
        `).run(cnpj, companyName, extractedName || null);
        empresaCriada = {
          id: Number(created.lastInsertRowid),
          cnpj,
          nome: companyName,
        };
        company = empresaCriada;
        db.prepare(`
          INSERT OR IGNORE INTO empresa_users
            (empresa_id, user_id, papel, ativo)
          VALUES (?, ?, 'admin', 1)
        `).run(company.id, req.user.id);
      }
      if (company) empresaId = company.id;
    }
    if (!empresaId)
      return res.status(422).json({ error: `Empresa não identificada${cnpj ? ` para o CNPJ ${cnpj}` : ": CNPJ ausente no PDF"}` });
    const parseDate = (value) => {
      const match = value?.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
      return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
    };
    const emissionText = text.match(/(?:EMISS[AÃ]O|EMITIDA?)(?:\s+EM|\s*:)?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i)?.[1];
    const validityText = text.match(/(?:VALIDADE|V[AÁ]LIDA?\s+AT[EÉ])(?:\s*:|\s+AT[EÉ])?\s*(\d{2}[\/.-]\d{2}[\/.-]\d{4})/i)?.[1];
    const allDates = [...text.matchAll(/\d{2}[\/.-]\d{2}[\/.-]\d{4}/g)].map((match) => match[0]);
    const dataEmissao = parseDate(emissionText || allDates[0]);
    const dataValidade = parseDate(validityText || allDates[1]);
    const tipo =
      /FGTS|FUNDO DE GARANTIA/.test(normalized) ? "fgts" :
      /TRABALHIST|CNDT/.test(normalized) ? "cndt" :
      /IMOBILI|IPTU/.test(normalized) ? "imobiliario" :
      /MUNICIP|PREFEITURA|ISS/.test(normalized) ? "municipal" :
      /ESTADUAL|FAZENDA DO ESTADO|ICMS/.test(normalized) ? "estadual" : "federal";
    const status =
      /POSITIVA COM EFEITOS? DE NEGATIVA/.test(normalized) ? "positiva_com_efeitos_de_negativa" :
      /CERTIDAO POSITIVA/.test(normalized) ? "positiva" : "negativa";
    const numeroCertidao =
      text.match(/(?:N[ÚU]MERO|N[º°O]\.?|C[ÓO]DIGO)(?:\s+DA\s+CERTID[AÃ]O)?\s*[:\-]?\s*([A-Z0-9./-]{5,})/i)?.[1] || null;
    const info = db.prepare(`
      INSERT INTO certidoes
        (empresa_id, tipo, data_emissao, data_validade, status, numero_certidao,
         observacoes, pdf_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const fileName = `cnd-${empresaId}-${Date.now()}.pdf`;
    fs.writeFileSync(path.join(PDF_DIR, fileName), req.file.buffer);
    const result = info.run(
      empresaId, tipo, dataEmissao, dataValidade, status, numeroCertidao,
      "Dados reconhecidos automaticamente do PDF", fileName,
    );
    const missing = [];
    if (!cnpj) missing.push("CNPJ");
    if (!dataEmissao) missing.push("data de emissão");
    if (!dataValidade) missing.push("data de validade");
    if (!numeroCertidao) missing.push("número da certidão");
    res.json({
      ok: true,
      id: Number(result.lastInsertRowid),
      empresaCriada,
      recognized: { cnpj, tipo, status, dataEmissao, dataValidade, numeroCertidao },
      missing,
      message: missing.length
        ? `${empresaCriada ? "Empresa cadastrada automaticamente. " : ""}Certidão gravada. Revise: ${missing.join(", ")}.`
        : `${empresaCriada ? "Empresa cadastrada automaticamente e " : "Certidão "}lida e gravada com sucesso.`,
    });
  } catch (error) {
    res.status(422).json({ error: `Não foi possível ler a certidão: ${error.message}` });
  }
});

router.put("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM certidoes WHERE id = ?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Certidão não encontrada" });
  archive(row);
  const body = req.body || {};
  db.prepare(`
    UPDATE certidoes SET
      tipo = COALESCE(?, tipo), data_emissao = COALESCE(?, data_emissao),
      data_validade = COALESCE(?, data_validade), status = COALESCE(?, status),
      numero_certidao = COALESCE(?, numero_certidao),
      observacoes = COALESCE(?, observacoes),
      alerta_modo = COALESCE(?, alerta_modo),
      alerta_dias = COALESCE(?, alerta_dias),
      alerta_dia_semana = COALESCE(?, alerta_dia_semana),
      alerta_dia_mes = COALESCE(?, alerta_dia_mes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    body.tipo || null, body.dataEmissao || null, body.dataValidade || null,
    body.status || null, body.numeroCertidao ?? null, body.observacoes ?? null,
    body.alertaModo || null, body.alertaDias ?? null,
    body.alertaDiaSemana ?? null, body.alertaDiaMes ?? null,
    row.id,
  );
  res.json(db.prepare("SELECT * FROM certidoes WHERE id = ?").get(row.id));
});

router.post("/:id/pdf", upload.single("pdf"), (req, res) => {
  const row = db.prepare("SELECT * FROM certidoes WHERE id = ?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Certidão não encontrada" });
  if (!req.file) return res.status(400).json({ error: "Selecione o PDF" });
  if (row.pdf_path) archive(row);
  const fileName = `cnd-${row.empresa_id}-${row.id}-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(PDF_DIR, fileName), req.file.buffer);
  db.prepare("UPDATE certidoes SET pdf_path = ?, updated_at = datetime('now') WHERE id = ?")
    .run(fileName, row.id);
  res.json({ ok: true, pdf_url: `/api/certidoes/${row.id}/pdf` });
});

router.get("/:id/pdf", (req, res) => {
  const row = db.prepare("SELECT pdf_path FROM certidoes WHERE id = ?").get(Number(req.params.id));
  if (!row?.pdf_path) return res.status(404).json({ error: "PDF não encontrado" });
  res.sendFile(path.join(PDF_DIR, row.pdf_path));
});

router.get("/:id/historico", (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM certidoes_historico WHERE certidao_id = ?
    ORDER BY id DESC
  `).all(Number(req.params.id));
  res.json(rows.map((row) => ({ ...row, dados: JSON.parse(row.dados) })));
});

router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM certidoes WHERE id = ?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Certidão não encontrada" });
  archive(row);
  db.prepare("DELETE FROM certidoes WHERE id = ?").run(row.id);
  res.json({ ok: true });
});

export default router;
