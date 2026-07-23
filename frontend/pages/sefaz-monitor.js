// =============================================================================
//  pages/sefaz-monitor.js — Monitor SEFAZ em tempo real
//  -----------------------------------------------------------------------------
//  Espelha o layout "Monitor SEFAZ" do SiscoFiscal ERP:
//  - 4 KPIs no topo (Online, Offline, Latência média, Última atualização)
//  - Grid de status por UF (verde/vermelho/amarelo com latência)
//  - Log de consultas embaixo
// =============================================================================
import { api, el, toast, fmtDate } from "../assets/app.js";

let interval = null;

export async function render(root) {
  // Limpa interval anterior se a página for recarregada
  if (interval) clearInterval(interval);

  // Topbar com breadcrumb
  root.appendChild(el("div", { class: "topbar" },
    el("div", { class: "crumbs" },
      el("span", {}, "Relatórios "),
      el("span", { class: "sep" }, "›"),
      el("strong", {}, "Monitor SEFAZ"),
    ),
  ));

  // ---- KPIs ----
  const kpiOnline = el("div", { class: "sisco-kpi" });
  const kpiOffline = el("div", { class: "sisco-kpi" });
  const kpiLat = el("div", { class: "sisco-kpi" });
  const kpiUpdated = el("div", { class: "sisco-kpi" });
  root.appendChild(el("div", { class: "sisco-kpis" },
    kpiOnline, kpiOffline, kpiLat, kpiUpdated,
  ));

  // ---- Tabela de status por UF ----
  const grid = el("div", { class: "uf-grid", style: "margin-bottom:18px" });
  root.appendChild(grid);

  // ---- Log de consultas ----
  const logWrap = el("div", { class: "sefaz-log" });
  root.appendChild(logWrap);

  // ---- Botão atualizar ----
  const refreshBtn = el("button", {
    class: "sisco-btn sisco-btn--primary",
    onClick: () => load(true),
  }, "🔄 Atualizar");
  // (Será adicionado no header do log)

  async function load(showToast = false) {
    if (showToast) toast("Consultando SEFAZ...");
    try {
      const r = await api("/api/sefaz-monitor");
      paint(r, showToast);
    } catch (e) {
      toast("Erro: " + e.message, "err");
    }
  }

  function paint(r, wasManual) {
    // ---- KPIs ----
    kpiOnline.innerHTML = "";
    kpiOnline.appendChild(el("div", { class: "sisco-kpi__label" }, "Serviços Online"));
    kpiOnline.appendChild(el("div", { class: "sisco-kpi__value sisco-kpi__value--green" }, String(r.online)));
    kpiOnline.appendChild(el("div", { class: "sisco-kpi__hint" }, `de ${r.total} UFs monitoradas`));

    kpiOffline.innerHTML = "";
    kpiOffline.appendChild(el("div", { class: "sisco-kpi__label" }, "Serviços Offline"));
    kpiOffline.appendChild(el("div", { class: "sisco-kpi__value sisco-kpi__value--red" }, String(r.offline)));
    kpiOffline.appendChild(el("div", { class: "sisco-kpi__hint" }, r.offline > 0 ? "Verifique pendências" : "Tudo operacional"));

    kpiLat.innerHTML = "";
    kpiLat.appendChild(el("div", { class: "sisco-kpi__label" }, "Latência Média"));
    kpiLat.appendChild(el("div", { class: "sisco-kpi__value sisco-kpi__value--blue" }, r.latencyAvg != null ? `${r.latencyAvg}ms` : "—"));
    kpiLat.appendChild(el("div", { class: "sisco-kpi__hint" }, "tempo médio de resposta"));

    kpiUpdated.innerHTML = "";
    kpiUpdated.appendChild(el("div", { class: "sisco-kpi__label" }, "Última Atualização"));
    kpiUpdated.appendChild(el("div", { class: "sisco-kpi__value" }, new Date(r.checkedAt).toLocaleTimeString("pt-BR")));
    kpiUpdated.appendChild(el("div", { class: "sisco-kpi__hint" }, new Date(r.checkedAt).toLocaleDateString("pt-BR")));

    // ---- Grid de UFs ----
    grid.innerHTML = "";
    for (const u of r.ufs) {
      const cls = u.ok ? "uf-card--ok" : (u.error === "timeout" ? "uf-card--warn" : "uf-card--off");
      const statusCls = u.ok ? "uf-card__status--ok" : (u.error === "timeout" ? "uf-card__status--warn" : "uf-card__status--off");
      const statusLabel = u.ok ? "● Online" : (u.error === "timeout" ? "● Lento" : "● Offline");
      const wifi = u.ok ? "📶" : "📡";
      const lat = u.ok ? `Latência: ${u.latency}ms` : (u.error === "timeout" ? "Timeout" : `Erro: ${u.error}`);

      grid.appendChild(el("div", { class: `uf-card ${cls}` },
        el("div", { class: "uf-card__head" },
          el("div", { class: "uf-card__uf" }, u.uf),
          el("div", { class: "uf-card__wifi" }, wifi),
        ),
        el("div", { class: `uf-card__status ${statusCls}` }, statusLabel),
        el("div", { class: "uf-card__latency" }, lat),
        el("div", { class: "uf-card__env" }, u.env),
      ));
    }

    // ---- Log de consultas (gerado a partir do status atual) ----
    logWrap.innerHTML = "";
    const head = el("div", { class: "sefaz-log__head" },
      el("span", {}, "Log de consultas SEFAZ"),
      refreshBtn,
    );
    const tbl = el("table", {},
      el("thead", {}, el("tr", {},
        el("th", {}, "Hora"),
        el("th", {}, "UF"),
        el("th", {}, "Código"),
        el("th", {}, "Resultado"),
      )),
      el("tbody", {}, ...r.ufs.slice(0, 15).map((u) => {
        const code = u.ok ? "200 OK" : (u.error || "503").toUpperCase();
        const codeCls = u.ok ? "code-ok" : "code-fail";
        const result = u.ok
          ? `Latência ${u.latency}ms`
          : (u.error === "timeout" ? "Serviço lento / timeout" : "Serviço indisponível");
        const time = new Date(r.checkedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        return el("tr", {},
          el("td", {}, time),
          el("td", {}, u.uf),
          el("td", { class: codeCls }, code),
          el("td", {}, result),
        );
      })),
    );
    logWrap.appendChild(head);
    logWrap.appendChild(tbl);

    if (wasManual) toast("✓ Consulta realizada");
  }

  // Primeira carga + auto-refresh a cada 60s
  await load(false);
  interval = setInterval(() => load(false), 60000);
}
