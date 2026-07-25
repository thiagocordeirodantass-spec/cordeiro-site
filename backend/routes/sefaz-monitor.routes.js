// =============================================================================
//  routes/sefaz-monitor.routes.js
//  -----------------------------------------------------------------------------
//  Monitor de status dos servidores da SEFAZ (NF-e, NFC-e, CT-e, MDF-e).
//  Consome a public-api do Monitor SEFAZ da WebmaniaBR:
//    https://monitorsefaz.webmaniabr.com/v3/components.json
//    https://monitorsefaz.webmaniabr.com/v3/summary.json
//  (API pública, sem autenticação, formato Atlassian/Statuspage v3).
//
//  Mantém o shape JSON que o frontend já consome, exibindo TODOS os
//  4 grupos (NFe, NFCe, CT-e, MDF-e) e cada estado/ambiente como um card.
// =============================================================================
import { Router } from "express";

const router = Router();

const BASE_URL = "https://monitorsefaz.webmaniabr.com";
const CACHE_TTL_MS = 30 * 1000; // 30s — frontend faz auto-refresh a cada 60s
const FETCH_TIMEOUT_MS = 5000;

let cache = null;             // última resposta em formato "ufs" (já mapeado)
let cacheAt = 0;              // timestamp do cache (Date.now())
let inflight = null;          // promise de fetch em andamento (dedupe)

// ---- Helpers HTTP ----
function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "CordeiroFiscalMonitor/1.0" } })
    .then((r) => {
      clearTimeout(t);
      if (!r.ok) throw new Error("Monitor SEFAZ respondeu HTTP " + r.status);
      return r.json();
    })
    .catch((e) => {
      clearTimeout(t);
      throw e;
    });
}

// ---- Mapeamento de status da public-api para o contrato do frontend ----
function mapStatus(component) {
  // O frontend usa: ok=true (verde), error="timeout" (amarelo), error="offline" (vermelho)
  // Mantemos o ternário: u.error === "timeout" -> classe amarela "Lento".
  const s = (component.status || "").toUpperCase();
  if (s === "OPERATIONAL") return { ok: true, error: null, statusCode: 200 };
  if (s === "DEGRADED" || s === "UNDER_MAINTENANCE") {
    return { ok: true, error: "timeout", statusCode: 200 };
  }
  // PARTIAL_OUTAGE, MAJOR_OUTAGE, INVESTIGATING e qualquer outro
  return { ok: false, error: "offline", statusCode: 503 };
}

function componentsToUfs(components) {
  const out = [];
  for (const c of components || []) {
    if (!c.group) continue; // ignora grupos-pai (que não têm group)
    const env = c.group.name || "";
    const mapped = mapStatus(c);
    out.push({
      uf: c.name,
      host: null,
      ok: mapped.ok,
      latency: 0, // a public-api não mede latência
      status: mapped.statusCode,
      error: mapped.error,
      env,
    });
  }
  return out;
}

async function loadFresh() {
  const json = await fetchJson(`${BASE_URL}/v3/components.json`);
  return componentsToUfs(json.components);
}

async function getUfs() {
  const now = Date.now();
  if (cache && (now - cacheAt) < CACHE_TTL_MS) return { ufs: cache, stale: false };
  if (inflight) return inflight.then(() => ({ ufs: cache || [], stale: false }));

  inflight = loadFresh()
    .then((ufs) => {
      cache = ufs;
      cacheAt = Date.now();
      return { ufs, stale: false };
    })
    .catch((e) => {
      // Em falha: se temos cache anterior (mesmo vencido), devolvemos como stale.
      // Senão, propagamos o erro (rota retorna 502).
      if (cache) return { ufs: cache, stale: true, error: e.message };
      throw e;
    })
    .finally(() => { inflight = null; });

  return inflight;
}

// ---- GET /api/sefaz-monitor ----
// Resposta (mantém o shape que o frontend já consome):
//   {
//     checkedAt: ISO,
//     total: N,
//     online: N,
//     offline: M,
//     latencyAvg: null,
//     stale: boolean,           // (campo extra; ignorado pelo frontend)
//     source: "webmaniabr",     // (campo extra; ignorado pelo frontend)
//     ufs: [{ uf, host, ok, latency, status, error, env }]
//   }
router.get("/", async (_req, res) => {
  try {
    const { ufs, stale = false, error: fetchError } = await getUfs();
    const online = ufs.filter((u) => u.ok).length;
    const offline = ufs.length - online;
    res.json({
      checkedAt: new Date().toISOString(),
      total: ufs.length,
      online,
      offline,
      latencyAvg: null, // a public-api não mede latência
      stale,
      source: "webmaniabr",
      ufs,
      ...(fetchError ? { fetchError } : {}),
    });
  } catch (e) {
    res.status(502).json({ error: "Falha ao consultar Monitor SEFAZ: " + e.message });
  }
});

export default router;
