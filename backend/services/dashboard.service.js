// =============================================================================
//  services/dashboard.service.js — agregados para o dashboard
//  =============================================================================
import { db } from "../db/index.js";

function safeQuery(sql, params = []) {
  try { return db.prepare(sql).all(...params); } catch (e) { return []; }
}

// Helper: aplica tenant filter em uma query e retorna SQL + params prontos.
// `where` é o texto (com ?), `param` é o id da empresa.
function tenantWhere(tenantFilter) {
  if (!tenantFilter) return { wh: "", p: [] };
  return { wh: ` AND ${tenantFilter.where}`, p: [tenantFilter.param] };
}

export function kpis(tenantFilter = null) {
  const now = new Date();
  const mes = now.toISOString().slice(0, 7);
  const hoje = now.toISOString().slice(0, 10);
  const { wh, p } = tenantWhere(tenantFilter);

  const total = safeQuery(`SELECT COUNT(*) as c FROM documents WHERE 1=1${wh}`, p)[0]?.c || 0;
  const totalNFe = safeQuery(`SELECT COUNT(*) as c FROM documents WHERE kind = 'NFE'${wh}`, p)[0]?.c || 0;
  const totalCTe = safeQuery(`SELECT COUNT(*) as c FROM documents WHERE kind = 'CTE'${wh}`, p)[0]?.c || 0;
  const cancelados = safeQuery(`SELECT COUNT(*) as c FROM documents WHERE status = 'cancelado'${wh}`, p)[0]?.c || 0;
  const valorTotal = safeQuery(`SELECT COALESCE(SUM(CAST(valor_total AS REAL)), 0) as v FROM documents WHERE 1=1${wh}`, p)[0]?.v || 0;
  const valorAutorizado = safeQuery(`SELECT COALESCE(SUM(CAST(valor_total AS REAL)), 0) as v FROM documents WHERE status = 'autorizado'${wh}`, p)[0]?.v || 0;

  const valorMes = safeQuery(`SELECT COALESCE(SUM(CAST(valor_total AS REAL)), 0) as v FROM documents WHERE substr(data_emissao, 1, 7) = ? AND status = 'autorizado'${wh}`, [mes, ...p])[0]?.v || 0;
  const docsMes = safeQuery(`SELECT COUNT(*) as c FROM documents WHERE substr(data_emissao, 1, 7) = ?${wh}`, [mes, ...p])[0]?.c || 0;
  const docsHoje = safeQuery(`SELECT COUNT(*) as c FROM documents WHERE substr(data_emissao, 1, 10) = ?${wh}`, [hoje, ...p])[0]?.c || 0;

  return {
    total, totalNFe, totalCTe, cancelados,
    valorTotal, valorAutorizado,
    valorMes, docsMes, docsHoje,
  };
}

export function porMes(ultimos = 12, tenantFilter = null) {
  const { wh, p } = tenantWhere(tenantFilter);
  const rows = safeQuery(`
    SELECT substr(data_emissao, 1, 7) as ym,
           COUNT(*) as qtd,
           COALESCE(SUM(CAST(valor_total AS REAL)), 0) as valor,
           SUM(CASE WHEN kind = 'NFE' THEN 1 ELSE 0 END) as qtd_nfe,
           SUM(CASE WHEN kind = 'CTE' THEN 1 ELSE 0 END) as qtd_cte
    FROM documents
    WHERE data_emissao IS NOT NULL AND data_emissao <> ''${wh}
    GROUP BY ym
    ORDER BY ym DESC
    LIMIT ?
  `, [...p, Number(ultimos) || 12]);
  return rows.reverse();
}

export function porUf(tenantFilter = null) {
  const { wh, p } = tenantWhere(tenantFilter);
  const rows = safeQuery(`
    SELECT uf_emitente as uf, COUNT(*) as qtd,
           COALESCE(SUM(CAST(valor_total AS REAL)), 0) as valor
    FROM documents
    WHERE uf_emitente IS NOT NULL AND uf_emitente <> ''${wh}
    GROUP BY uf_emitente
    ORDER BY qtd DESC
    LIMIT 27
  `, p);
  return rows;
}

export function topParceiros({ papel = "destinatario", limite = 10 } = {}, tenantFilter = null) {
  const coluna = papel === "remetente" ? "remetente_nome" : "destinatario_nome";
  const { wh, p } = tenantWhere(tenantFilter);
  const rows = safeQuery(`
    SELECT ${coluna} as nome, COUNT(*) as qtd,
           COALESCE(SUM(CAST(valor_total AS REAL)), 0) as valor
    FROM documents
    WHERE ${coluna} IS NOT NULL AND ${coluna} <> ''${wh}
    GROUP BY ${coluna}
    ORDER BY valor DESC
    LIMIT ?
  `, [...p, Number(limite) || 10]);
  return rows;
}

export function porStatus(tenantFilter = null) {
  const { wh, p } = tenantWhere(tenantFilter);
  return safeQuery(`
    SELECT status, COUNT(*) as qtd
    FROM documents
    WHERE 1=1${wh}
    GROUP BY status
    ORDER BY qtd DESC
  `, p);
}
