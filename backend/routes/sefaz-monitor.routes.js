// =============================================================================
//  routes/sefaz-monitor.routes.js
//  -----------------------------------------------------------------------------
//  Monitor de status dos servidores da SEFAZ (NF-e e CT-e).
//  Faz um HEAD request com timeout para cada endpoint autorizador conhecido
//  e retorna latência + status online/offline.
//
//  Os URLs vêm de uma tabela estática (não muda). Para atualizar, edite abaixo.
// =============================================================================
import { Router } from "express";
import https from "node:https";
import dns from "node:dns/promises";

const router = Router();

// ---- Tabela de UFs com URL do webservice de status (NF-e) ----
// Fonte: NT 2025.002 / Portal Nacional da NF-e
// O endpoint "NFeStatusServico" aceita um POST mínimo; aqui usamos HEAD
// apenas para checar se o servidor responde (sem montar XML).
const UFS = [
  { uf: "AC", host: "nfe.svrs.rs.gov.br" },
  { uf: "AL", host: "nfe.svrs.rs.gov.br" },
  { uf: "AM", host: "nfe.svrs.rs.gov.br" },
  { uf: "AP", host: "nfe.svrs.rs.gov.br" },
  { uf: "BA", host: "nfe.svba.ba.gov.br" },
  { uf: "CE", host: "nfe.svce.ce.gov.br" },
  { uf: "DF", host: "nfe.svdf.df.gov.br" },
  { uf: "ES", host: "nfe.sves.es.gov.br" },
  { uf: "GO", host: "nfe.svgo.go.gov.br" },
  { uf: "MA", host: "nfe.svma.ma.gov.br" },
  { uf: "MG", host: "nfe.svrs.rs.gov.br" },
  { uf: "MS", host: "nfe.svms.ms.gov.br" },
  { uf: "MT", host: "nfe.svmt.mt.gov.br" },
  { uf: "PA", host: "nfe.svpa.pa.gov.br" },
  { uf: "PB", host: "nfe.svpb.pb.gov.br" },
  { uf: "PE", host: "nfe.svpe.pe.gov.br" },
  { uf: "PI", host: "nfe.svpi.pi.gov.br" },
  { uf: "PR", host: "nfe.svpr.pr.gov.br" },
  { uf: "RJ", host: "nfe.svrj.rj.gov.br" },
  { uf: "RN", host: "nfe.svrn.rn.gov.br" },
  { uf: "RO", host: "nfe.svro.ro.gov.br" },
  { uf: "RR", host: "nfe.svrr.rr.gov.br" },
  { uf: "RS", host: "nfe.svrs.rs.gov.br" },
  { uf: "SC", host: "nfe.svsc.sc.gov.br" },
  { uf: "SE", host: "nfe.svse.se.gov.br" },
  { uf: "SP", host: "nfe.svsp.fazenda.sp.gov.br" },
  { uf: "TO", host: "nfe.svto.to.gov.br" },
];

// Ambiente SVC-AN e SVC-RS (Sefaz Virtual de Contingência)
const SVC = [
  { uf: "SVC-AN", host: "nfe.svc-an.fazenda.gov.br" },
  { uf: "SVC-RS", host: "nfe.svc-rs.fazenda.gov.br" },
];

// ---- Checa um host com timeout ----
function checkHost(host, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const started = Date.now();
    // Tenta resolver DNS primeiro (mais barato que o request)
    dns.lookup(host)
      .then(() => {
        const req = https.request(
          {
            host,
            port: 443,
            method: "HEAD",
            path: "/",
            timeout: timeoutMs,
            headers: { "User-Agent": "CordeiroFiscalMonitor/1.0" },
          },
          (res) => {
            const latency = Date.now() - started;
            // Qualquer resposta (mesmo 4xx) significa que o servidor está de pé.
            // Erros de SSL/connection refused = offline.
            res.resume();
            resolve({ ok: true, latency, status: res.statusCode });
          }
        );
        req.on("timeout", () => {
          req.destroy();
          resolve({ ok: false, latency: Date.now() - started, error: "timeout" });
        });
        req.on("error", (e) => {
          resolve({ ok: false, latency: Date.now() - started, error: e.code || e.message });
        });
        req.end();
      })
      .catch((e) => {
        resolve({ ok: false, latency: Date.now() - started, error: "dns:" + (e.code || e.message) });
      });
  });
}

// ---- GET /api/sefaz/monitor ----
// Resposta:
//   {
//     checkedAt: ISO,
//     total: 28,
//     online: 26, offline: 2,
//     latencyAvg: 412,
//     ufs: [{ uf, host, ok, latency, status, error, env }]
//   }
router.get("/", async (_req, res) => {
  const checks = await Promise.all([
    ...UFS.map((u) => checkHost(u.host).then((r) => ({ ...u, ...r, env: "Produção" }))),
    ...SVC.map((u) => checkHost(u.host).then((r) => ({ ...u, ...r, env: "SVC" }))),
  ]);

  const online = checks.filter((c) => c.ok).length;
  const offline = checks.length - online;
  const okChecks = checks.filter((c) => c.ok && c.latency > 0);
  const latencyAvg = okChecks.length
    ? Math.round(okChecks.reduce((s, c) => s + c.latency, 0) / okChecks.length)
    : null;

  res.json({
    checkedAt: new Date().toISOString(),
    total: checks.length,
    online,
    offline,
    latencyAvg,
    ufs: checks.map((c) => ({
      uf: c.uf,
      host: c.host,
      ok: c.ok,
      latency: c.ok ? c.latency : null,
      status: c.status || null,
      error: c.error || null,
      env: c.env,
    })),
  });
});

export default router;
