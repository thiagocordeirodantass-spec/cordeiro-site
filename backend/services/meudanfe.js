// =============================================================================
//  Integracao com o servico do MeuDANFe (https://meudanfe.com.br)
//  -----------------------------------------------------------------------------
//  O MeuDANFe NAO publica documentacao da API de busca por chave. O codigo
//  abaixo foi REVERSO ENGENHEIRADO do JavaScript do site
//  (https://meudanfe.com.br/assets/js/danfe.js) e usa a API real:
//
//    _URL_WS = "https://ws.meudanfe.com.br"
//
//  Endpoints:
//    GET  /v2/fd/init            → { pid }                            (1x por sessao)
//    PUT  /v2/fd/add/{chave}     → header {pid}, body=encryptT0KEN(tokenCaptcha+'ic')
//                                  → { status: "OK"|"NOT_FOUND"|"WAITING"|"SEARCHING", id }
//    GET  /v2/fd/get/da/{id}     → { name, data: base64(PDF) }
//    GET  /v2/fd/get/xml/{id}    → { name, data: XML em string }
//
//  Fluxo de busca por chave (igual ao site):
//    1) GET /v2/fd/init → guarda pid
//    2) Front resolve o Turnstile do Cloudflare (captcha invisivel)
//    3) Front envia o token (cifrado em base64 pelo encryptT0KEN) para o backend
//    4) Backend faz PUT /v2/fd/add/{chave} e POLL até status="OK" (max 30s)
//    5) Se OK, backend chama GET /v2/fd/get/xml/{id} para pegar o XML
//
//  Como o token do Turnstile expira a cada uso, o FRONTEND precisa resolver
//  um captcha novo a cada consulta. O backend apenas orquestra.
// =============================================================================
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

const CONFIG_PATH_FACTORY = (dataDir) => path.join(dataDir, "meudanfe.config.json");

const DEFAULT_CONFIG = {
  // API key da Area do Cliente (nao usada na busca por chave gratuita,
  // mas mantida para futuro uso e para a rota XML->PDF)
  apiKey: "",
  // Endpoint publico e gratuito de conversao XML -> DANFE/DACTE PDF
  xmlToPdfUrl: "https://ws.meudanfe.com/api/v1/get/nfe/xmltodanfepdf/API",
  // URL base do ws (reverso-engenhado do site)
  wsBase: "https://ws.meudanfe.com.br",
  // Sitekey publica do Turnstile (Cloudflare). OBRIGATORIO cadastrar no
  // Cloudflare (https://www.cloudflare.com/products/turnstile/) com o dominio
  // deste sistema e colar a sitekey aqui (ou via /api/meudanfe/config).
  // A sitekey do site do MeuDANFe nao funciona porque Turnstile e tied-to-domain.
  turnstileSiteKey: "",
  // Timeout por tentativa (ms)
  timeoutMs: 20000,
  // Tempo maximo de polling esperando status="OK" (ms)
  pollMaxMs: 30000,
  // Intervalo entre tentativas de polling (ms)
  pollIntervalMs: 1000,
};

// ---- Cliente HTTP generico (sem dependencias externas) ----
function request(urlStr, { method = "GET", headers = {}, body = null, timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); }
    catch (e) { return reject(new Error("URL invalida: " + urlStr)); }
    const lib = u.protocol === "https:" ? https : http;
    const payload = body ? (Buffer.isBuffer(body) ? body : Buffer.from(body, "utf-8")) : null;
    const req = lib.request(
      u,
      {
        method,
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
          Accept: "*/*",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timeout ao contatar MeuDANFe")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---- encryptT0KEN: reverte o codigo do danfe.js ----
//   function encryptT0KEN(token) {
//       const bytes = new TextEncoder().encode(token.trim());
//       let bin = '';
//       bytes.forEach(b => bin += String.fromCharCode(b));
//       return btoa(bin);
//   }
// Equivalente em Node: base64 do UTF-8.
function encryptToken(token) {
  return Buffer.from(String(token || "").trim(), "utf-8").toString("base64");
}

// ---- Config ----
export function loadConfig(dataDir) {
  const p = CONFIG_PATH_FACTORY(dataDir);
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(dataDir, partial) {
  const p = CONFIG_PATH_FACTORY(dataDir);
  const current = loadConfig(dataDir);
  const next = { ...current, ...partial };
  fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function maskConfig(cfg) {
  return {
    ...cfg,
    apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}${"•".repeat(Math.max(0, cfg.apiKey.length - 8))}${cfg.apiKey.slice(-4)}` : "",
    apiKeyConfigured: Boolean(cfg.apiKey),
    turnstileSiteKey: cfg.turnstileSiteKey || DEFAULT_CONFIG.turnstileSiteKey,
  };
}

// ---- PID em cache (5 min) ----
let pidCache = { value: null, at: 0 };
const PID_TTL_MS = 5 * 60 * 1000;
async function getPid(cfg) {
  const now = Date.now();
  if (pidCache.value && (now - pidCache.at) < PID_TTL_MS) return pidCache.value;
  const res = await request(`${cfg.wsBase}/v2/fd/init`, { method: "GET", timeoutMs: cfg.timeoutMs || 20000 });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`MeuDANFe /v2/fd/init respondeu ${res.status}: ${res.body.toString("utf-8").slice(0, 200)}`);
  }
  const json = JSON.parse(res.body.toString("utf-8") || "{}");
  if (!json.pid) throw new Error("MeuDANFe nao retornou pid em /v2/fd/init");
  pidCache = { value: json.pid, at: now };
  return json.pid;
}

// ---- Fluxo de busca por chave: PUT /v2/fd/add/{chave} + polling ----
async function fdAdd(cfg, pid, chave, turnstileToken) {
  // No site, o codigo faz: o (tokenTurnstile) + 'ic' → encryptT0KEN( ... +' ' ) → body
  // Ou seja: encryptT0KEN(turnstileToken + "ic" + " ") = base64(utf-8(token + "ic" + " "))
  const bodyText = encryptToken(turnstileToken + "ic" + " ");
  const url = `${cfg.wsBase}/v2/fd/add/${encodeURIComponent(chave)}`;
  const res = await request(url, {
    method: "PUT",
    headers: { pid, "Content-Type": "text/plain" },
    body: bodyText,
    timeoutMs: cfg.timeoutMs || 20000,
  });
  if (res.status === 401) throw new Error("Captcha invalido. Atualize a pagina e tente novamente.");
  if (res.status === 429) throw new Error("Muitas consultas em pouco tempo. Tente novamente em alguns minutos.");
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`MeuDANFe PUT /v2/fd/add respondeu ${res.status}: ${res.body.toString("utf-8").slice(0, 200)}`);
  }
  let json;
  try { json = JSON.parse(res.body.toString("utf-8") || "{}"); }
  catch (e) { throw new Error("Resposta invalida do MeuDANFe (nao e JSON)"); }
  return json; // { status, id? }
}

async function fdAddWithPolling(cfg, pid, chave, turnstileToken) {
  const started = Date.now();
  // Primeira tentativa
  let last = await fdAdd(cfg, pid, chave, turnstileToken);
  while (last && (last.status === "WAITING" || last.status === "SEARCHING")) {
    if ((Date.now() - started) > (cfg.pollMaxMs || 30000)) {
      throw new Error("Tempo limite esgotado aguardando o MeuDANFe processar a chave (30s). Tente novamente.");
    }
    await new Promise((r) => setTimeout(r, cfg.pollIntervalMs || 1000));
    last = await fdAdd(cfg, pid, chave, turnstileToken);
  }
  return last; // { status, id? }
}

async function fdGetXml(cfg, id) {
  const res = await request(`${cfg.wsBase}/v2/fd/get/xml/${encodeURIComponent(id)}`, {
    method: "GET",
    timeoutMs: cfg.timeoutMs || 20000,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`MeuDANFe GET /v2/fd/get/xml respondeu ${res.status}: ${res.body.toString("utf-8").slice(0, 200)}`);
  }
  const json = JSON.parse(res.body.toString("utf-8") || "{}");
  if (!json.data) throw new Error("MeuDANFe nao retornou o XML (campo data vazio)");
  return json; // { name, data: string XML }
}

async function fdGetDa(cfg, id) {
  const res = await request(`${cfg.wsBase}/v2/fd/get/da/${encodeURIComponent(id)}`, {
    method: "GET",
    timeoutMs: cfg.timeoutMs || 20000,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`MeuDANFe GET /v2/fd/get/da respondeu ${res.status}: ${res.body.toString("utf-8").slice(0, 200)}`);
  }
  const json = JSON.parse(res.body.toString("utf-8") || "{}");
  if (!json.data) throw new Error("MeuDANFe nao retornou o PDF (campo data vazio)");
  return json; // { name, data: base64 do PDF }
}

// ---- Converte XML em DANFE/DACTE PDF (endpoint publico) ----
export async function xmlParaDanfePdf(cfg, xmlText) {
  const res = await request(cfg.xmlToPdfUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      ...(cfg.apiKey ? { "Api-Key": cfg.apiKey } : {}),
    },
    body: xmlText,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`MeuDANFe (XML->PDF) respondeu ${res.status}: ${res.body.toString("utf-8").slice(0, 300)}`);
  }
  // O endpoint publico retorna o PDF em base64 dentro de { pdf: "..." } ou binario puro
  const contentType = res.headers["content-type"] || "";
  if (contentType.includes("application/pdf") || res.body.slice(0, 5).toString("latin1") === "%PDF-") {
    return res.body;
  }
  const asText = res.body.toString("utf-8").trim();
  try {
    const j = JSON.parse(asText);
    const b64 = j.pdf || j.data || j.base64 || j.arquivo;
    if (b64) {
      const buf = Buffer.from(b64, "base64");
      if (buf.slice(0, 5).toString("latin1") === "%PDF-") return buf;
    }
  } catch (e) { /* nao era JSON */ }
  throw new Error(
    "Nao foi possivel interpretar a resposta do MeuDANFe como PDF. Resposta bruta: " +
      asText.slice(0, 300)
  );
}

// ---- Busca o XML de uma NF-e/CT-e pela chave ----
// Agora exige turnstileToken (resolvido no front via widget Cloudflare).
export async function chaveParaXml(cfg, chave, turnstileToken) {
  if (!turnstileToken) {
    throw new Error("E necessario resolver o captcha antes de consultar a chave.");
  }
  const chaves44 = String(chave).replace(/\D/g, "");
  if (chaves44.length !== 44) throw new Error("Chave deve ter 44 digitos");

  const pid = await getPid(cfg);
  const addResp = await fdAddWithPolling(cfg, pid, chaves44, turnstileToken);

  if (addResp.status === "NOT_FOUND") {
    throw new Error("Chave nao encontrada no MeuDANFe (NOT_FOUND).");
  }
  if (addResp.status !== "OK" || !addResp.id) {
    throw new Error(`MeuDANFe retornou status inesperado: "${addResp.status || "?"}".`);
  }

  const xmlResp = await fdGetXml(cfg, addResp.id);
  return xmlResp.data; // string XML
}

// ---- Versao que retorna tambem o searchId, util para o caller pedir o PDF depois ----
export async function chaveParaXmlComId(cfg, chave, turnstileToken) {
  if (!turnstileToken) {
    throw new Error("E necessario resolver o captcha antes de consultar a chave.");
  }
  const chaves44 = String(chave).replace(/\D/g, "");
  if (chaves44.length !== 44) throw new Error("Chave deve ter 44 digitos");
  const pid = await getPid(cfg);
  const addResp = await fdAddWithPolling(cfg, pid, chaves44, turnstileToken);
  if (addResp.status === "NOT_FOUND") throw new Error("Chave nao encontrada no MeuDANFe (NOT_FOUND).");
  if (addResp.status !== "OK" || !addResp.id) {
    throw new Error(`MeuDANFe retornou status inesperado: "${addResp.status || "?"}".`);
  }
  return { id: addResp.id, pid };
}

export async function getDanfePdfById(cfg, id) {
  const da = await fdGetDa(cfg, id);
  const buf = Buffer.from(da.data, "base64");
  if (buf.slice(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("Resposta do MeuDANFe nao parece ser um PDF valido");
  }
  return buf;
}

export async function getXmlById(cfg, id) {
  const xml = await fdGetXml(cfg, id);
  return xml.data;
}
