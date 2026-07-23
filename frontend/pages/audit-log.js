// =============================================================================
//  pages/audit-log.js — histórico de relatórios gerados (componente)
//  -----------------------------------------------------------------------------
//  Importado por relatorios.js para a aba "Histórico".
//  Mantém compatibilidade com render(root) para deep-link antigo.
// =============================================================================
import { api, toast, el, fmtDate } from "../assets/app.js";

export async function render(root) {
  root.appendChild(el("div", { class: "topbar" }, el("div", { class: "crumbs" }, el("strong", {}, "Histórico / Auditoria"))));
  const host = el("div", { class: "card" }, el("div", { class: "card__body" }));
  root.appendChild(host);
  await renderAuditTab(host);
}

export async function renderAuditTab(host) {
  await reload();

  async function reload() {
    let items = [];
    try { items = await api("/api/relatorio/historico?limit=200"); } catch (e) { toast(e.message, "err"); return; }
    host.innerHTML = "";
    if (!items.length) {
      host.appendChild(el("div", { style: "padding:30px; text-align:center; color:var(--sisco-text-muted, #7a869a)" },
        "Nenhuma geração registrada ainda."));
      return;
    }
    const t = el("table", { class: "sisco-table" },
      el("thead", {}, el("tr", {},
        el("th", {}, "Data"), el("th", {}, "Usuário"), el("th", {}, "Formato"),
        el("th", {}, "Template"), el("th", {}, "Documentos"), el("th", {}, "Tamanho"),
        el("th", {}, "Ações"),
      )),
      el("tbody", {}, ...items.map(row)),
    );
    const wrap = el("div", { class: "sisco-table-wrap" },
      el("div", { class: "sisco-table-head" },
        el("h2", {}, `Histórico de gerações (${items.length})`),
      ),
      t,
    );
    host.appendChild(wrap);
  }
  function row(h) {
    return el("tr", {},
      el("td", {}, fmtDate(h.created_at)),
      el("td", {}, h.username || "(removido)"),
      el("td", {},
        el("span", { class: "sisco-badge sisco-badge--info" }, h.formato.toUpperCase()),
      ),
      el("td", {}, h.template_nome || "—"),
      el("td", { class: "num" }, String(h.total_docs)),
      el("td", { class: "num" }, h.tamanho_bytes ? formatBytes(h.tamanho_bytes) : "—"),
      el("td", { class: "row-actions" },
        h.filtros
          ? el("button", { onClick: () => rebaixar(h) }, "↻ Re-baixar")
          : el("span", { class: "kv__label" }, "—"),
      ),
    );
  }
  async function rebaixar(h) {
    const qs = new URLSearchParams(h.filtros || {}).toString();
    const base = h.formato === "xlsx" ? "/api/relatorio/xlsx"
               : h.formato === "csv" ? "/api/relatorio/csv"
               : h.formato === "pdf" ? "/api/relatorio/pdf"
               : h.formato === "zip" ? "/api/relatorio/lote" : null;
    if (!base) { toast("Formato desconhecido", "err"); return; }
    window.location.href = base + "?" + qs;
  }
}

function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}
