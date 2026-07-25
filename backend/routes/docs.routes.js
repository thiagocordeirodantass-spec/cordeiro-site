// =============================================================================
//  routes/docs.routes.js — CRUD de documentos (NF-e, CT-e, NFC-e)
//  -----------------------------------------------------------------------------
//  Mantém o mesmo contrato dos endpoints originais do projeto.
//  Permissões:
//    - leitura:  qualquer usuário autenticado
//    - escrita (import/upload/delete): somente admin ou operador
// =============================================================================
import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import os from "os";
import { db } from "../db/index.js";
import { XML_DIR_PATH, parseXml, saveDocument, getXmlPathByRow } from "../services/documents.service.js";
import { requireRole } from "../middleware/requireRole.js";
import * as meudanfe from "../services/meudanfe.js";
import { fileURLToPath } from "url";
import pathMod from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathMod.dirname(__filename);
const DATA_DIR = pathMod.resolve(__dirname, "..", "..", "data");

const router = Router();

// ---- Multer com DISK storage para suportar milhares de arquivos sem estourar RAM
// Escreve cada upload em arquivo temporário (os.tmpdir) e libera memória imediatamente.
// fileSize: 20MB por arquivo. files/parts: até 10.000 arquivos por requisição.
// IMPORTANTE: sem "parts" explícito, o busboy corta em 200 parts (default).
const TMP_DIR = path.join(os.tmpdir(), "cordeiro-uploads");
try { fs.mkdirSync(TMP_DIR, { recursive: true }); } catch (e) { /* ok */ }
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_DIR),
    filename: (_req, file, cb) => {
      const safe = (file.originalname || "upload.xml").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`);
    },
  }),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 10000,
    parts: 10000,
    fieldSize: 5 * 1024 * 1024,
  },
});

// ---- Healthcheck
router.get("/_health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ---- Estatísticas
router.get("/_stats", (req, res) => {
  const tf = req.tenantFilter;
  const wh = tf ? `WHERE ${tf.where}` : "";
  const p = tf ? [tf.param] : [];
  const total = db.prepare(`SELECT COUNT(*) as c FROM documents ${wh}`).get(...p).c;
  const nfe = db.prepare(`SELECT COUNT(*) as c FROM documents ${wh ? wh + " AND" : "WHERE"} kind = 'NFE'`).get(...p).c;
  const cte = db.prepare(`SELECT COUNT(*) as c FROM documents ${wh ? wh + " AND" : "WHERE"} kind = 'CTE'`).get(...p).c;
  const canc = db.prepare(`SELECT COUNT(*) as c FROM documents ${wh ? wh + " AND" : "WHERE"} status = 'cancelado'`).get(...p).c;
  const valorTotal = db.prepare(`SELECT COALESCE(SUM(CAST(valor_total AS REAL)), 0) as v FROM documents ${wh}`).get(...p).v;
  res.json({ total, nfe, cte, cancelados: canc, valorTotal });
});

// ---- Listagem com filtros
router.get("/", (req, res) => {
  const {
    kind, status, q, uf, dateFrom, dateTo, papel, meuCnpj, source,
    limit = 25, offset = 0, page = 1,
    // Filtros novos (item 9 da lista de requisitos)
    emitenteCnpj, emitenteRazaoSocial, emitenteNomeFantasia,
    destinatarioNome, destinatarioDoc,
    chaveAcesso,
    cancelados, dataCancelamentoFrom, dataCancelamentoTo,
    registrada, dataRegistroFrom, dataRegistroTo,
    registrosInvalidos, invalidado, assinaturaInvalida, schemaInvalido,
    tipoDocumento, terceiros, cartaCorrecao,
    ultimaManifestacao, dataUltimaManifestacaoFrom, dataUltimaManifestacaoTo, semManifestacao,
    dataValidacaoRegraFrom, dataValidacaoRegraTo, regraValidacao, regraViolada,
    finalidadeEmissao, tipoOperacao,
  } = req.query;
  const where = [];
  const params = [];
  // Multi-tenancy: aplica filtro de empresa SEMPRE que houver tenant ativo
  // (super-admin sem empresa ativa vê tudo)
  if (req.tenantFilter) {
    where.push(req.tenantFilter.where);
    params.push(req.tenantFilter.param);
  }
  if (kind) { where.push("kind = ?"); params.push(String(kind).toUpperCase()); }
  if (status) { where.push("status = ?"); params.push(status); }
  if (source) { where.push("source = ?"); params.push(String(source)); }
  if (uf) { where.push("(uf_emitente = ? OR uf_destino = ?)"); params.push(uf, uf); }
  if (dateFrom) { where.push("date(data_emissao) >= date(?)"); params.push(dateFrom); }
  if (dateTo) { where.push("date(data_emissao) <= date(?)"); params.push(dateTo); }
  if (q) {
    where.push("(remetente_nome LIKE ? OR destinatario_nome LIKE ? OR chave LIKE ? OR numero LIKE ? OR remetente_doc LIKE ? OR destinatario_doc LIKE ? OR emitente_razao_social LIKE ? OR emitente_nome_fantasia LIKE ? OR emitente_cnpj LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like, like, like);
  }
  if (papel && meuCnpj) {
    const cnpjDigits = String(meuCnpj).replace(/\D/g, "");
    if (papel === "emitidas") {
      where.push("REPLACE(REPLACE(remetente_doc,'.',''),'-','') LIKE ?");
      params.push(`%${cnpjDigits}%`);
    } else if (papel === "recebidas") {
      where.push("REPLACE(REPLACE(destinatario_doc,'.',''),'-','') LIKE ?");
      params.push(`%${cnpjDigits}%`);
    }
  }
  // Filtros novos
  if (emitenteCnpj) {
    const d = String(emitenteCnpj).replace(/\D/g, "");
    where.push("REPLACE(REPLACE(REPLACE(REPLACE(emitente_cnpj,'.',''),'-',''),'/',''),' ','') LIKE ?");
    params.push(`%${d}%`);
  }
  if (emitenteRazaoSocial) { where.push("emitente_razao_social LIKE ?"); params.push(`%${emitenteRazaoSocial}%`); }
  if (emitenteNomeFantasia) { where.push("emitente_nome_fantasia LIKE ?"); params.push(`%${emitenteNomeFantasia}%`); }
  if (destinatarioNome) { where.push("(destinatario_tomador_nome LIKE ? OR destinatario_nome LIKE ?)"); params.push(`%${destinatarioNome}%`, `%${destinatarioNome}%`); }
  if (destinatarioDoc) {
    const d = String(destinatarioDoc).replace(/\D/g, "");
    where.push("(REPLACE(REPLACE(REPLACE(REPLACE(destinatario_tomador_doc,'.',''),'-',''),'/',''),' ','') LIKE ? OR REPLACE(REPLACE(REPLACE(REPLACE(destinatario_doc,'.',''),'-',''),'/',''),' ','') LIKE ?)");
    params.push(`%${d}%`, `%${d}%`);
  }
  if (chaveAcesso) { where.push("chave LIKE ?"); params.push(`%${chaveAcesso}%`); }
  if (cancelados === "1" || cancelados === "true") { where.push("cancelado = 1"); }
  else if (cancelados === "0" || cancelados === "false") { where.push("COALESCE(cancelado, 0) = 0"); }
  if (dataCancelamentoFrom) { where.push("date(data_cancelamento) >= date(?)"); params.push(dataCancelamentoFrom); }
  if (dataCancelamentoTo) { where.push("date(data_cancelamento) <= date(?)"); params.push(dataCancelamentoTo); }
  if (registrada === "1" || registrada === "true") { where.push("registrada_erp = 1"); }
  else if (registrada === "0" || registrada === "false") { where.push("COALESCE(registrada_erp, 0) = 0"); }
  if (dataRegistroFrom) { where.push("date(data_registro_erp) >= date(?)"); params.push(dataRegistroFrom); }
  if (dataRegistroTo) { where.push("date(data_registro_erp) <= date(?)"); params.push(dataRegistroTo); }
  if (registrosInvalidos === "1" || registrosInvalidos === "true") { where.push("registro_invalido = 1"); }
  else if (registrosInvalidos === "0" || registrosInvalidos === "false") { where.push("COALESCE(registro_invalido, 0) = 0"); }
  if (invalidado === "1" || invalidado === "true") { where.push("invalidado = 1"); }
  else if (invalidado === "0" || invalidado === "false") { where.push("COALESCE(invalidado, 0) = 0"); }
  if (assinaturaInvalida === "1" || assinaturaInvalida === "true") { where.push("assinatura_invalida = 1"); }
  else if (assinaturaInvalida === "0" || assinaturaInvalida === "false") { where.push("COALESCE(assinatura_invalida, 0) = 0"); }
  if (schemaInvalido === "1" || schemaInvalido === "true") { where.push("schema_invalido = 1"); }
  else if (schemaInvalido === "0" || schemaInvalido === "false") { where.push("COALESCE(schema_invalido, 0) = 0"); }
  if (tipoDocumento) { where.push("tipo_documento = ?"); params.push(String(tipoDocumento)); }
  if (terceiros === "1" || terceiros === "true") { where.push("documento_terceiros = 1"); }
  else if (terceiros === "0" || terceiros === "false") { where.push("COALESCE(documento_terceiros, 0) = 0"); }
  if (cartaCorrecao === "1" || cartaCorrecao === "true") { where.push("carta_correcao = 1"); }
  else if (cartaCorrecao === "0" || cartaCorrecao === "false") { where.push("COALESCE(carta_correcao, 0) = 0"); }
  if (ultimaManifestacao) { where.push("ultima_manifestacao = ?"); params.push(String(ultimaManifestacao)); }
  if (dataUltimaManifestacaoFrom) { where.push("date(data_ultima_manifestacao) >= date(?)"); params.push(dataUltimaManifestacaoFrom); }
  if (dataUltimaManifestacaoTo) { where.push("date(data_ultima_manifestacao) <= date(?)"); params.push(dataUltimaManifestacaoTo); }
  if (semManifestacao === "1" || semManifestacao === "true") { where.push("sem_manifestacao = 1"); }
  else if (semManifestacao === "0" || semManifestacao === "false") { where.push("COALESCE(sem_manifestacao, 0) = 0"); }
  if (dataValidacaoRegraFrom) { where.push("date(data_validacao_regra) >= date(?)"); params.push(dataValidacaoRegraFrom); }
  if (dataValidacaoRegraTo) { where.push("date(data_validacao_regra) <= date(?)"); params.push(dataValidacaoRegraTo); }
  if (regraValidacao) { where.push("regra_validacao LIKE ?"); params.push(`%${regraValidacao}%`); }
  if (regraViolada) { where.push("regra_violada LIKE ?"); params.push(`%${regraViolada}%`); }
  if (finalidadeEmissao) { where.push("finalidade_emissao = ?"); params.push(String(finalidadeEmissao)); }
  if (tipoOperacao) { where.push("tipo_operacao = ?"); params.push(String(tipoOperacao)); }

  const sql = `
    SELECT id, kind, modelo, chave, numero, serie, data_emissao,
           uf_emitente, uf_destino, remetente_nome, remetente_doc,
           destinatario_nome, destinatario_doc, valor_total, status, protocolo,
           source, created_at, updated_at,
           emitente_cnpj, emitente_razao_social, emitente_nome_fantasia,
           destinatario_tomador_doc, destinatario_tomador_nome,
           cancelado, data_cancelamento,
           registrada_erp, data_registro_erp,
           registro_invalido, invalidado, assinatura_invalida, schema_invalido,
           tipo_documento, documento_terceiros, carta_correcao,
           ultima_manifestacao, data_ultima_manifestacao, sem_manifestacao,
           data_validacao_regra, regra_validacao, regra_violada,
           finalidade_emissao, tipo_operacao, empresa_id,
           (SELECT COALESCE(u.nome,u.username) FROM users u WHERE u.id=documents.created_by) AS created_by_name
    FROM documents
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  const safeLimit=Math.min(100,Math.max(10,Number(limit)||25));
  const safeOffset=req.query.page ? (Math.max(1,Number(page)||1)-1)*safeLimit : Math.max(0,Number(offset)||0);
  const countParams=[...params];
  params.push(safeLimit,safeOffset);
  const items=db.prepare(sql).all(...params);
  const total=db.prepare(`SELECT COUNT(*) total FROM documents ${where.length ? "WHERE "+where.join(" AND ") : ""}`).get(...countParams).total;
  res.json({items,total:Number(total),page:Math.floor(safeOffset/safeLimit)+1,limit:safeLimit,
    pages:Math.max(1,Math.ceil(Number(total)/safeLimit))});
});

// ---- Detalhe
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const tf = req.tenantFilter;
  const wh = tf ? ` AND ${tf.where}` : "";
  const p = tf ? [id, String(req.params.id), tf.param] : [id, String(req.params.id)];
  const row = db.prepare(`SELECT * FROM documents WHERE (id = ? OR chave = ?)${wh}`).get(...p);
  if (!row) return res.status(404).json({ error: "Nao encontrado" });
  let xml = null;
  try { xml = fs.readFileSync(getXmlPathByRow(row), "utf-8"); } catch (e) { xml = null; }
  res.json({ ...row, xml });
});

// ---- Download XML
router.get("/:id/xml", (req, res) => {
  const tf = req.tenantFilter;
  const wh = tf ? ` AND ${tf.where}` : "";
  const p = tf ? [Number(req.params.id) || 0, String(req.params.id), tf.param] : [Number(req.params.id) || 0, String(req.params.id)];
  const row = db.prepare(`SELECT xml_path, chave, empresa_id FROM documents WHERE (id = ? OR chave = ?)${wh}`).get(...p);
  if (!row) return res.status(404).json({ error: "Nao encontrado" });
  const filePath = getXmlPathByRow(row);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo nao encontrado" });
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${row.chave || "documento"}.xml"`);
  fs.createReadStream(filePath).pipe(res);
});

// ---- Baixar DANFE PDF (oficial, via MeuDANFe) — por id OU chave
router.get("/:id/pdf", async (req, res) => {
  const tf = req.tenantFilter;
  const wh = tf ? ` AND ${tf.where}` : "";
  const p = tf ? [Number(req.params.id) || 0, String(req.params.id), tf.param] : [Number(req.params.id) || 0, String(req.params.id)];
  const row = db.prepare(`SELECT * FROM documents WHERE (id = ? OR chave = ?)${wh}`).get(...p);
  if (!row) return res.status(404).json({ error: "Documento nao encontrado" });
  let xmlText;
  try { xmlText = fs.readFileSync(getXmlPathByRow(row), "utf-8"); } catch (e) {
    return res.status(404).json({ error: "Arquivo XML nao encontrado no disco" });
  }
  try {
    const cfg = meudanfe.loadConfig(DATA_DIR);
    const pdf = await meudanfe.xmlParaDanfePdf(cfg, xmlText);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `attachment; filename="danfe-${row.kind}-${row.numero || row.chave || row.id}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(502).json({ error: "Falha ao gerar DANFE via MeuDANFe: " + e.message });
  }
});

// ---- Buscar por número
router.get("/numero/:numero", (req, res) => {
  const { numero } = req.params;
  const { kind } = req.query;
  const where = ["numero = ?"];
  const params = [String(numero)];
  if (kind) { where.push("kind = ?"); params.push(String(kind).toUpperCase()); }
  if (req.tenantFilter) { where.push(req.tenantFilter.where); params.push(req.tenantFilter.param); }
  res.json(db.prepare(
    `SELECT id, kind, modelo, chave, numero, serie, data_emissao,
            remetente_nome, destinatario_nome, valor_total, status
     FROM documents WHERE ${where.join(" AND ")}
     ORDER BY datetime(data_emissao) DESC`).all(...params));
});

// ---- Importar via JSON
router.post("/import", requireRole("admin", "operador"), (req, res) => {
  const { xml, kind, source, fileName, empresaId } = req.body || {};
  if (!xml) return res.status(400).json({ error: "xml nao fornecido" });
  // resolve empresa: body > ativa; só permite mudar se super-admin
  let eId = req.tenantId || null;
  if (empresaId != null && empresaId !== "" && req.isSuperAdmin) {
    eId = Number(empresaId);
  }
  const result = saveDocument({ xmlText: xml, kind, source: source || "paste", fileName, empresaId: eId, userId: req.user?.id });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

// ---- Importar via upload (vários arquivos)
// Usa multer com diskStorage (ver declaração acima) e processa cada arquivo
// lendo do disco e apagando imediatamente para liberar memória.
router.post("/upload", requireRole("admin", "operador"), upload.array("files", 10000), (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: "Nenhum arquivo enviado" });
  const results = [];
  const tmpFiles = [];
  try {
    for (const f of files) {
      tmpFiles.push(f.path);
      let xmlText = "";
      try {
        xmlText = fs.readFileSync(f.path, "utf-8");
      } catch (e) {
        results.push({ fileName: f.originalname, ok: false, error: "Falha ao ler arquivo: " + e.message });
        continue;
      }
      const r = saveDocument({ xmlText, source: "upload", fileName: f.originalname, empresaId: req.tenantId || null, userId: req.user?.id });
      results.push({ fileName: f.originalname, ...r });
      // Libera o XML do result para não acumular em memória na resposta
      delete r.xml;
    }
    res.json({ processed: results });
  } catch (e) {
    res.status(500).json({ error: "Erro ao processar upload: " + e.message });
  } finally {
    // Apaga os arquivos temporários imediatamente para liberar disco
    for (const p of tmpFiles) {
      try { fs.unlinkSync(p); } catch (e) { /* ok */ }
    }
  }
});

// ---- Remover (com backup automático antes de excluir)
router.delete("/:id", requireRole("admin", "operador"), (req, res) => {
  const id = Number(req.params.id);
  const tf = req.tenantFilter;
  const wh = tf ? ` AND ${tf.where}` : "";
  const p = tf ? [id, tf.param] : [id];
  const row = db.prepare(`SELECT xml_path, chave FROM documents WHERE id = ?${wh}`).get(...p);
  if (!row) return res.status(404).json({ error: "Nao encontrado" });
  // Apaga o registro (a FK do banco nao tem cascade, mas documents.id nao é referenciado)
  const info = db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  if (info.changes === 0) return res.status(404).json({ error: "Nao encontrado" });
  // Apaga o XML em disco, mas só se nenhum outro registro usa o mesmo arquivo
  const stillUsed = db.prepare("SELECT COUNT(*) as c FROM documents WHERE xml_path = ?").get(row.xml_path).c;
  if (stillUsed === 0) {
    try { fs.unlinkSync(path.join(XML_DIR_PATH, row.xml_path)); } catch (e) { /* arquivo ja sumiu */ }
  }
  res.json({ ok: true });
});

export default router;
