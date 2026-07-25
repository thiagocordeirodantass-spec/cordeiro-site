// =============================================================================
//  routes/relatorios.routes.js
//  -----------------------------------------------------------------------------
//  Endpoints:
//    GET  /api/relatorio/xlsx              — Excel (padrão ou personalizado)
//    GET  /api/relatorio/csv               — NOVO: CSV
//    GET  /api/relatorio/pdf               — NOVO: PDF tabular
//    GET  /api/relatorio/lote              — download em lote (zip)
//    GET  /api/relatorio/templates         — listar templates
//    POST /api/relatorio/templates         — criar template
//    GET  /api/relatorio/templates/:id     — obter template
//    PUT  /api/relatorio/templates/:id     — atualizar
//    DELETE /api/relatorio/templates/:id   — remover
//    GET  /api/relatorio/historico         — listar execuções
//    POST /api/relatorio/historico/:id/rebaixar — re-gerar a partir do histórico
// =============================================================================
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { getXmlPathByRow, parseXml } from "../services/documents.service.js";
import { COLUNAS_DISPONIVEIS, CAMPOS_PERMITIDOS, filtrosToString, buscarDocs, formatRow, resumo, semSufixoZero, TEMPLATES_MODULOS } from "../services/relatorio.service.js";
import { gerarXlsx, headerRow, dataRow } from "../services/xlsx.service.js";
import { buildCsv } from "../services/csv.service.js";
import { renderRelatorioTabularPdf, formatDatePdf, buildDocPdfFromXmlText } from "../services/pdf.service.js";
import { ZipWriter, buildZipPath } from "../zip-writer.js";
import * as templates from "../services/templates.service.js";
import * as audit from "../services/audit.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// ---- Helpers comuns ----
const RELATORIO_COLS = [
  "Número", "Série", "Chave de acesso", "Emissão", "UF Emit.", "UF Dest.",
  "Remetente", "Doc. Remetente", "Destinatário", "Doc. Destinatário",
  "Valor", "Status", "Protocolo", "Origem",
];
const RELATORIO_WIDTHS = [10, 8, 26, 18, 8, 8, 28, 18, 28, 18, 14, 12, 18, 10];

function docRowToXlsx(d) {
  return dataRow(
    [
      semSufixoZero(d.numero), semSufixoZero(d.serie), d.chave || "",
      formatDatePdf(d.data_emissao), d.uf_emitente || "", d.uf_destino || "",
      d.remetente_nome || "", semSufixoZero(d.remetente_doc),
      d.destinatario_nome || "", semSufixoZero(d.destinatario_doc),
      Number(d.valor_total) || 0, d.status || "",
      semSufixoZero(d.protocolo), d.source || "",
    ],
    [10]
  );
}

function stamp() {
  return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
}

function textoUtf8(value) {
  let text = String(value ?? "");
  // Corrige rótulos legados que foram gravados como UTF-8 interpretado em Latin-1.
  for (let i = 0; i < 2 && /Ã|Â|â/.test(text); i++) {
    const fixed = Buffer.from(text, "latin1").toString("utf8");
    if (!fixed || fixed.includes("\uFFFD")) break;
    text = fixed;
  }
  return text;
}

function flattenFiscal(value, prefix = "", output = {}, options = {}) {
  if (value == null) return output;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      flattenFiscal(item, `${prefix}[${index + 1}]`, output, options),
    );
    return output;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (options.skipDet && key === "det") continue;
      const path = prefix ? `${prefix}.${key}` : key;
      flattenFiscal(child, path, output, options);
    }
    return output;
  }
  output[prefix] = value;
  return output;
}

function reportLabel(pathName) {
  return textoUtf8(
    pathName
      .replace(/^XML\.(nfeProc|cteProc)\./, "")
      .replace(/^XML\.(NFe|CTe)\./, "")
      .replace(/\._@/g, " ")
      .replace(/@_/g, "")
      .replace(/\./g, " › "),
  );
}

// Relatório fiscal integral: uma única planilha, com todas as tags do XML.
// NF-e com vários itens gera uma linha para cada produto e repete os dados da nota.
function gerarRelatorioUnificado(docs) {
  const fixedHeaders = [
    "Documento › Tipo",
    "Documento › Número da nota fiscal",
    "Documento › Série",
    "Documento › Chave de acesso",
    "Documento › Data de emissão",
    "Documento › Status",
    "Documento › Origem",
  ];
  const objects = [];
  const xmlHeaders = new Set();
  for (const d of docs) {
    const base = {
      "Documento › Tipo": d.kind || "",
      "Documento › Número da nota fiscal": semSufixoZero(d.numero),
      "Documento › Série": semSufixoZero(d.serie),
      "Documento › Chave de acesso": d.chave || "",
      "Documento › Data de emissão": formatDatePdf(d.data_emissao),
      "Documento › Status": d.status || "",
      "Documento › Origem": d.source || "",
    };
    try {
      const xml = fs.readFileSync(getXmlPathByRow(d), "utf-8");
      const parsed = parseXml(xml) || {};
      const infNFe = parsed?.nfeProc?.NFe?.infNFe || parsed?.NFe?.infNFe;
      let details = infNFe?.det || [];
      if (!Array.isArray(details)) details = details ? [details] : [];
      const common = {};
      flattenFiscal(parsed, "XML", common, { skipDet: Boolean(infNFe) });
      const commonLabeled = Object.fromEntries(
        Object.entries(common).map(([key, value]) => [
          reportLabel(key),
          value,
        ]),
      );
      if (!details.length) details = [null];
      details.forEach((detail, index) => {
        const item = {};
        if (detail) flattenFiscal(detail, "Produto", item);
        const row = {
          ...base,
          ...commonLabeled,
          "Produto › Linha": detail ? index + 1 : "",
          ...item,
        };
        Object.keys(row).forEach((key) => {
          if (!fixedHeaders.includes(key)) xmlHeaders.add(key);
        });
        objects.push(row);
      });
    } catch {
      objects.push(base);
    }
  }
  const headers = [...fixedHeaders, ...xmlHeaders];
  const numericCols = headers
    .map((header, index) => {
      const values = objects
        .map((row) => row[header])
        .filter((value) => value !== "" && value != null);
      return values.length && values.every((value) => typeof value === "number")
        ? index
        : -1;
    })
    .filter((index) => index >= 0);
  const rows = objects.map((row) =>
    dataRow(headers.map((header) => row[header] ?? ""), numericCols),
  );
  return gerarXlsx([{
    name: "Documentos e Produtos",
    colWidths: headers.map((header) =>
      /descrição|xProd|xNome|infCpl/i.test(header) ? 34 :
      /chave|Id$|CNPJ|CPF/i.test(header) ? 24 : 16,
    ),
    freezeHeader: true,
    rows: [headerRow(headers), ...rows],
  }]);
}

// =============================================================================
//  GET /api/relatorio/campos
//  Lista todas as colunas disponíveis para uso em /api/relatorio/{xlsx,csv,pdf}?campos=
// =============================================================================
router.get("/campos", (_req, res) => {
  const campos = Object.entries(COLUNAS_DISPONIVEIS).map(([key, def]) => ({
    key,
    label: textoUtf8(def.label),
    width: def.width || 12,
    numeric: !!def.numeric,
  }));
  res.json({ campos, total: campos.length });
});

// =============================================================================
//  GET /api/relatorio/templates-modulos
//  Retorna os templates pré-definidos por módulo (NFE, CTE, GERAIS)
// =============================================================================
router.get("/templates-modulos", (_req, res) => {
  const out = {};
  for (const [modulo, tpls] of Object.entries(TEMPLATES_MODULOS)) {
    out[modulo] = Object.entries(tpls).map(([nome, campos]) => ({
      nome, campos,
    }));
  }
  res.json(out);
});

// =============================================================================
//  GET /api/relatorio/xlsx
// =============================================================================
router.get("/xlsx", (req, res) => {
  try {
    const docs = buscarDocs(req.query, { tenantFilter: req.tenantFilter });
    // O relatório padrão é sempre unificado. Personalização por `campos`
    // continua disponível quando o usuário selecionar colunas específicas.
    if (!req.query.campos) {
      const buffer = gerarRelatorioUnificado(docs);
      const filename = `relatorio-unificado-${stamp()}.xlsx`;
      audit.registrar({
        userId: req.user.id, username: req.user.username, formato: "xlsx",
        filtros: req.query, totalDocs: docs.length, tamanhoBytes: buffer.length,
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    }
    let buffer;
    let filename;

    if (req.query.campos) {
      const campos = String(req.query.campos).split(",").map((c) => c.trim()).filter((c) => CAMPOS_PERMITIDOS.includes(c));
      if (!campos.length) return res.status(400).json({ error: "Nenhuma coluna valida informada em 'campos'" });
      const labels = campos.map((c) => textoUtf8(COLUNAS_DISPONIVEIS[c].label));
      const numericCols = campos.map((c, i) => (COLUNAS_DISPONIVEIS[c].numeric ? i : -1)).filter((i) => i >= 0);
      const rows = docs.map((d) => dataRow(formatRow(d, campos), numericCols));
      buffer = gerarXlsx([{
        name: "Relatório", colWidths: campos.map(() => 18), freezeHeader: true,
        rows: [headerRow(labels), ...rows],
      }]);
      filename = `relatorio-personalizado-${stamp()}.xlsx`;
    } else {
      const nfes = docs.filter((d) => d.kind === "NFE");
      const ctes = docs.filter((d) => d.kind === "CTE");
      const incluirItens = String(req.query.itens || "") === "1";
      const totalAutorizado = docs.filter((d) => d.status === "autorizado").reduce((s, d) => s + (Number(d.valor_total) || 0), 0);
      const r = resumo(docs);
      const sheets = [{
        name: "Resumo", colWidths: [28, 22], rows: [
          headerRow(["Métrica", "Valor"]),
          dataRow(["Gerado em", formatDatePdf(new Date().toISOString())]),
          dataRow(["Filtros aplicados", filtrosToString(req.query)]),
          dataRow(["Total de documentos", r.total], [1]),
          dataRow(["Total NF-e", r.nfe], [1]),
          dataRow(["Total CT-e", r.cte], [1]),
          dataRow(["Autorizados", r.autorizados], [1]),
          dataRow(["Cancelados", r.cancelados], [1]),
          dataRow(["Valor total (autorizados)", r.valorAutorizado], [1]),
        ],
      }, {
        name: "NF-e", colWidths: RELATORIO_WIDTHS, freezeHeader: true,
        rows: [headerRow(RELATORIO_COLS), ...nfes.map(docRowToXlsx)],
      }, {
        name: "CT-e", colWidths: RELATORIO_WIDTHS, freezeHeader: true,
        rows: [headerRow(RELATORIO_COLS), ...ctes.map(docRowToXlsx)],
      }];

      if (incluirItens) {
        // ---- Coleta todos os itens de todas as NF-e ----
        // Cada item: { docNumero, docChave, cProd, xProd, NCM, CFOP, uCom, qCom, vUnCom, vProd }
        const allItens = [];
        for (const d of nfes) {
          try {
            const xmlText = fs.readFileSync(getXmlPathByRow(d), "utf-8");
            const parsed = parseXml(xmlText);
            if (!parsed) continue;
            const infNFe = parsed.nfeProc?.NFe?.infNFe || parsed.NFe?.infNFe;
            if (!infNFe) continue;
            let det = infNFe.det; if (det && !Array.isArray(det)) det = [det];
            for (const it of (det || [])) {
              const p = it.prod || {};
              allItens.push({
                docNumero: d.numero || "",
                docChave: d.chave || "",
                docData: d.data_emissao || "",
                docEmit: d.remetente_nome || d.emitente_razao_social || "",
                cProd: p.cProd || "",
                xProd: p.xProd || "",
                NCM: p.NCM || "",
                CFOP: p.CFOP || "",
                uCom: p.uCom || "",
                qCom: Number(p.qCom) || 0,
                vUnCom: Number(p.vUnCom) || 0,
                vProd: Number(p.vProd) || 0,
              });
            }
          } catch (e) {}
        }

        // ---- Aba 1: Itens por NF-e (uma linha por item, com cProd) ----
        const itensRows = allItens.map((it) => dataRow(
          [it.docNumero, it.docChave, it.cProd, it.xProd, it.NCM, it.CFOP,
           it.uCom, it.qCom, it.vUnCom, it.vProd],
          [7, 8, 9]
        ));
        sheets.push({
          name: "Itens NF-e", colWidths: [10, 26, 16, 30, 12, 10, 8, 12, 14, 14], freezeHeader: true,
          rows: [headerRow(["Nº NF-e", "Chave", "Cód. Produto", "Descrição", "NCM", "CFOP", "Un.", "Qtd.", "Vlr. Unit.", "Vlr. Total"]), ...itensRows],
        });

        // ---- Aba 2: Resumo por produto (agrupado por cProd + xProd) ----
        const porProduto = new Map();
        for (const it of allItens) {
          const key = `${it.cProd}::${it.xProd}`;
          if (!porProduto.has(key)) {
            porProduto.set(key, { cProd: it.cProd, xProd: it.xProd, qtd: 0, valor: 0, nfs: new Set() });
          }
          const r = porProduto.get(key);
          r.qtd += it.qCom;
          r.valor += it.vProd;
          r.nfs.add(it.docChave);
        }
        const prodRows = Array.from(porProduto.values())
          .sort((a, b) => b.valor - a.valor)
          .map((r) => dataRow(
            [r.cProd, r.xProd, r.qtd, r.valor, r.nfs.size],
            [2, 3, 4]
          ));
        const prodTotal = Array.from(porProduto.values()).reduce((s, r) => s + r.valor, 0);
        sheets.push({
          name: "Por Produto", colWidths: [16, 40, 12, 16, 12], freezeHeader: true,
          rows: [
            headerRow(["Cód. Produto", "Descrição", "Qtd. Total", "Valor Total", "Nº NF-es"]),
            ...prodRows,
            dataRow(["", "TOTAL", "", prodTotal, "", ""], [3]),
          ],
        });

        // ---- Aba 3: Resumo por CFOP ----
        const porCfop = new Map();
        for (const it of allItens) {
          if (!it.CFOP) continue;
          if (!porCfop.has(it.CFOP)) porCfop.set(it.CFOP, { cfop: it.CFOP, qtd: 0, valor: 0, itens: 0 });
          const r = porCfop.get(it.CFOP);
          r.qtd += it.qCom;
          r.valor += it.vProd;
          r.itens += 1;
        }
        const cfopRows = Array.from(porCfop.values())
          .sort((a, b) => b.valor - a.valor)
          .map((r) => dataRow([r.cfop, r.itens, r.qtd, r.valor], [2, 3]));
        sheets.push({
          name: "Por CFOP", colWidths: [10, 12, 14, 18], freezeHeader: true,
          rows: [headerRow(["CFOP", "Itens", "Qtd. Total", "Valor Total"]), ...cfopRows],
        });

        // ---- Aba 4: Resumo por NCM ----
        const porNcm = new Map();
        for (const it of allItens) {
          if (!it.NCM) continue;
          if (!porNcm.has(it.NCM)) porNcm.set(it.NCM, { ncm: it.NCM, qtd: 0, valor: 0, itens: 0 });
          const r = porNcm.get(it.NCM);
          r.qtd += it.qCom;
          r.valor += it.vProd;
          r.itens += 1;
        }
        const ncmRows = Array.from(porNcm.values())
          .sort((a, b) => b.valor - a.valor)
          .map((r) => dataRow([r.ncm, r.itens, r.qtd, r.valor], [2, 3]));
        sheets.push({
          name: "Por NCM", colWidths: [12, 12, 14, 18], freezeHeader: true,
          rows: [headerRow(["NCM", "Itens", "Qtd. Total", "Valor Total"]), ...ncmRows],
        });
      }

      buffer = gerarXlsx(sheets);
      filename = `relatorio-fiscal-${stamp()}.xlsx`;
    }

    audit.registrar({
      userId: req.user.id, username: req.user.username, formato: "xlsx",
      filtros: req.query, totalDocs: docs.length, tamanhoBytes: buffer.length,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) { res.status(500).json({ error: "Falha ao gerar relatorio: " + e.message }); }
});

// =============================================================================
//  GET /api/relatorio/csv  (NOVO)
// =============================================================================
router.get("/csv", (req, res) => {
  try {
    const docs = buscarDocs(req.query, { tenantFilter: req.tenantFilter });
    const campos = (req.query.campos ? String(req.query.campos).split(",").map((c) => c.trim()).filter((c) => CAMPOS_PERMITIDOS.includes(c))
      : CAMPOS_PERMITIDOS);
    const columns = campos.map((c) => ({
      key: c, label: textoUtf8(COLUNAS_DISPONIVEIS[c].label), numeric: !!COLUNAS_DISPONIVEIS[c].numeric,
      get: COLUNAS_DISPONIVEIS[c].get,
    }));
    const csv = buildCsv(columns, docs);

    audit.registrar({
      userId: req.user.id, username: req.user.username, formato: "csv",
      filtros: req.query, totalDocs: docs.length, tamanhoBytes: Buffer.byteLength(csv, "utf-8"),
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-${stamp()}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: "Falha ao gerar CSV: " + e.message }); }
});

// =============================================================================
//  GET /api/relatorio/pdf  (NOVO)
// =============================================================================
router.get("/pdf", (req, res) => {
  try {
    const docs = buscarDocs(req.query, { tenantFilter: req.tenantFilter });
    const campos = (req.query.campos ? String(req.query.campos).split(",").map((c) => c.trim()).filter((c) => CAMPOS_PERMITIDOS.includes(c))
      : CAMPOS_PERMITIDOS);
    const columns = campos.map((c) => ({
      key: c, label: textoUtf8(COLUNAS_DISPONIVEIS[c].label), width: COLUNAS_DISPONIVEIS[c].width || 12,
    }));
    const rows = docs.map((d) => formatRow(d, campos).map((v) => v == null ? "-" : String(v)));
    const r = resumo(docs);
    const pdf = renderRelatorioTabularPdf({
      titulo: "Relatório Fiscal",
      filtrosAplicados: filtrosToString(req.query),
      columns, rows, count: docs.length,
      totalLabel: "Valor total (autorizados)",
      totalValor: r.valorAutorizado,
    });

    audit.registrar({
      userId: req.user.id, username: req.user.username, formato: "pdf",
      filtros: req.query, totalDocs: docs.length, tamanhoBytes: pdf.length,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-${stamp()}.pdf"`);
    res.send(pdf);
  } catch (e) { res.status(500).json({ error: "Falha ao gerar PDF: " + e.message }); }
});

// =============================================================================
//  GET /api/relatorio/lote  (.zip em lote)
// =============================================================================
router.get("/lote", (req, res) => {
  try {
    const docs = buscarDocs(req.query, { tenantFilter: req.tenantFilter });
    if (!docs.length) return res.status(404).json({ error: "Nenhum documento encontrado com esses filtros" });

    const formato = req.query.formato || "xml_pdf";
    const organizar = String(req.query.organizar ?? "1") === "1";
    const meuCnpjDigits = String(req.query.meuCnpj || "").replace(/\D/g, "");

    const zip = new ZipWriter();
    let count = 0;
    for (const d of docs) {
      let xmlText = null;
      try { xmlText = fs.readFileSync(getXmlPathByRow(d), "utf-8"); } catch (e) { continue; }

      const nomeEmpresaPasta = d.remetente_nome || d.remetente_doc || "Emitente desconhecido";
      const periodoPasta = (d.data_emissao || "").slice(0, 7) || "sem-data";
      const statusPasta = d.status === "cancelado" ? "Cancelada" : (d.status === "denegado" || d.status === "rejeitado" ? "Substituida" : null);
      let papelPasta;
      if (!meuCnpjDigits) papelPasta = d.kind === "NFE" ? "NFe" : "CTe";
      else {
        const rem = String(d.remetente_doc || "").replace(/\D/g, "");
        const dest = String(d.destinatario_doc || "").replace(/\D/g, "");
        if (rem.includes(meuCnpjDigits)) papelPasta = "Emitidas";
        else if (dest.includes(meuCnpjDigits)) papelPasta = "Recebidas";
        else papelPasta = d.kind === "NFE" ? "NFe" : "CTe";
      }
      const partes = organizar ? [nomeEmpresaPasta, periodoPasta, papelPasta, statusPasta].filter(Boolean) : [];
      const baseName = `${d.kind}-${semSufixoZero(d.numero) || d.chave || d.id}`;
      if (formato === "xml" || formato === "xml_zip" || formato === "xml_pdf") {
        zip.addFile(buildZipPath([...partes, `${baseName}.xml`]), xmlText);
      }
      if (formato === "pdf" || formato === "xml_pdf") {
        try {
          const pdf = buildDocPdfFromXmlText(xmlText, d.kind);
          if (pdf) zip.addFile(buildZipPath([...partes, `${baseName}.pdf`]), pdf);
        } catch (e) {}
      }
      count++;
    }
    if (!count) return res.status(404).json({ error: "Nenhum XML encontrado no disco para os documentos filtrados" });
    const buf = zip.toBuffer();
    audit.registrar({
      userId: req.user.id, username: req.user.username, formato: "zip",
      filtros: req.query, totalDocs: count, tamanhoBytes: buf.length,
    });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="documentos-${stamp()}.zip"`);
    res.send(buf);
  } catch (e) { res.status(500).json({ error: "Falha ao gerar pacote: " + e.message }); }
});

// =============================================================================
//  Templates
// =============================================================================
router.get("/templates", (req, res) => res.json(templates.listarTemplates(req.user)));

router.post("/templates", (req, res) => {
  try { res.json(templates.criarTemplate(req.user, req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/templates/:id", (req, res) => {
  const t = templates.obterTemplate(Number(req.params.id), req.user);
  if (!t) return res.status(404).json({ error: "Template não encontrado ou sem acesso" });
  res.json(t);
});

router.put("/templates/:id", (req, res) => {
  try { res.json(templates.atualizarTemplate(Number(req.params.id), req.user, req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/templates/:id", (req, res) => {
  try { res.json(templates.removerTemplate(Number(req.params.id), req.user)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// =============================================================================
//  Histórico de relatórios
// =============================================================================
router.get("/historico", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const todos = req.query.todos === "1";
  res.json(audit.listar({ user: req.user, limit, todos }));
});

router.post("/historico/:id/rebaixar", (req, res) => {
  const h = audit.obter(Number(req.params.id), req.user);
  if (!h) return res.status(404).json({ error: "Entrada de histórico não encontrada" });
  if (!h.filtros) return res.status(400).json({ error: "Histórico sem filtros registrados" });
  // Redireciona para o endpoint apropriado conforme o formato original
  const qs = new URLSearchParams(h.filtros || {}).toString();
  const base = h.formato === "xlsx" ? "/api/relatorio/xlsx"
             : h.formato === "csv" ? "/api/relatorio/csv"
             : h.formato === "pdf" ? "/api/relatorio/pdf"
             : h.formato === "zip" ? "/api/relatorio/lote"
             : null;
  if (!base) return res.status(400).json({ error: "Formato desconhecido" });
  res.redirect(302, `${base}?${qs}`);
});

export default router;
