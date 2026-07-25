// =============================================================================
//  pages/relatorios.js — Central de relatórios compacta e interativa
//  -----------------------------------------------------------------------------
//  Layout: 3 cards lado-a-lado (Filtros | Templates | Colunas + Ação)
//  Abas:   Gerar | Meus templates | Histórico
// =============================================================================
import { api, apiDownload, toast, el, fmtDate } from "../assets/app.js";
import { renderTemplatesTab } from "./templates-list.js";
import { renderAuditTab } from "./audit-log.js";

let TODOS_CAMPOS = [];
let TEMPLATES_MODULOS = {};

const FORMATOS = [
  { value: "xlsx", label: "Excel", ext: "xlsx", icon: "📊", cor: "var(--success)" },
  { value: "csv",  label: "CSV",   ext: "csv",  icon: "📋", cor: "var(--mod-users)" },
  { value: "pdf",  label: "PDF",   ext: "pdf",  icon: "📕", cor: "var(--error)" },
  { value: "zip",  label: "ZIP",   ext: "zip",  icon: "📦", cor: "var(--warn)" },
];

export async function render(root) {
  if (!TODOS_CAMPOS.length) {
    try {
      const r = await api("/api/relatorio/campos");
      TODOS_CAMPOS = r.campos || [];
    } catch (e) { TODOS_CAMPOS = []; }
  }
  try {
    TEMPLATES_MODULOS = await api("/api/relatorio/templates-modulos");
  } catch (e) { TEMPLATES_MODULOS = { NFE: [], CTE: [], GERAIS: [] }; }

  root.appendChild(el("div", { class: "topbar" },
    el("div", { class: "crumbs" },
      el("span", {}, "Início"),
      el("span", { class: "sep" }, "›"),
      el("strong", {}, "Relatórios"),
    ),
    el("div", { class: "topbar__actions" },
      el("button", { class: "toolbar__btn toolbar__btn--ghost", onClick: () => location.reload() }, "🔄 Atualizar"),
    ),
  ));

  // ---- Sistema de abas (estilo pills) ----
  const tabBar = el("div", { class: "rel-tabs" });
  const tabHosts = {};

  function makeTab(key, label, icon) {
    const btn = el("button", {
      class: "rel-tab",
      "data-tab": key,
      onClick: () => activateTab(key),
    },
      el("span", { class: "rel-tab__icon" }, icon || ""),
      el("span", { class: "rel-tab__label" }, label),
    );
    tabBar.appendChild(btn);
    tabHosts[key] = el("div", { class: "tab-pane", "data-tab": key });
    tabHosts[key].style.display = "none";
    return btn;
  }

  function activateTab(key) {
    for (const b of tabBar.querySelectorAll(".rel-tab")) {
      b.classList.toggle("is-active", b.dataset.tab === key);
    }
    for (const [k, host] of Object.entries(tabHosts)) {
      host.style.display = k === key ? "" : "none";
    }
    // atualiza o hash
    if (location.hash !== `#/relatorios/${key}`) {
      history.replaceState(null, "", `#/relatorios/${key}`);
    }
  }

  makeTab("gerar", "Gerar", "📊");
  makeTab("templates", "Meus templates", "💾");
  makeTab("historico", "Histórico", "📜");
  root.appendChild(tabBar);

  // ---- Container das abas ----
  const tabsContainer = el("div", { class: "rel-tabs-host" });
  tabsContainer.appendChild(tabHosts.gerar);
  tabsContainer.appendChild(tabHosts.templates);
  tabsContainer.appendChild(tabHosts.historico);
  root.appendChild(tabsContainer);

  await renderGerarTab(tabHosts.gerar);
  await renderTemplatesTab(tabHosts.templates);
  await renderAuditTab(tabHosts.historico);

  // Ativa a aba padrão
  activateTab("gerar");

  // Se o hash veio com #/relatorios/templates ou #/relatorios/historico, ativa a aba certa
  const m = (location.hash || "").match(/relatorios\/(templates|historico|gerar)/);
  if (m) activateTab(m[1]);

  // ---- Aplica template pendente (vindo de "Usar" em Meus templates) ----
  const pending = sessionStorage.getItem("cordeiro:applyTemplate");
  if (pending) {
    sessionStorage.removeItem("cordeiro:applyTemplate");
    try {
      const t = JSON.parse(pending);
      applyTemplate(t);
      activateTab("gerar");
      toast(`✓ Template "${t.nome || "selecionado"}" aplicado`);
    } catch (e) { /* template malformado, ignora */ }
  }
}

function applyTemplate(t) {
  window.dispatchEvent(new CustomEvent("cordeiro:applyTemplate", { detail: t }));
}

async function renderGerarTab(root) {
  // ====== Layout compacto: 2 linhas ======
  // Linha 1: Hero com tipo/formato + stats rápidos
  // Linha 2: 3 colunas: Filtros | Templates | Colunas

  // ---- Filtros principais ----
  const f_kind = sel("NFE", [["", "Todos os tipos"], ["NFE", "NF-e"], ["CTE", "CT-e"]]);
  const f_status = sel("", [["", "Todos status"], ["autorizado", "Autorizado"], ["cancelado", "Cancelado"], ["denegado", "Denegado"], ["rejeitado", "Rejeitado"], ["pendente", "Pendente"]]);
  const f_uf = el("input", { class: "input", placeholder: "UF" });
  const f_from = el("input", { class: "input", type: "date", title: "De" });
  const f_to = el("input", { class: "input", type: "date", title: "Até" });
  const f_q = el("input", { class: "input", placeholder: "🔎 Buscar (chave, CNPJ, nome, número)" });
  const f_incluirItens = el("input", { type: "checkbox", id: "f-incluir-itens" });
  // Quando o usuário marcar "Incluir itens", marcamos automaticamente
  // as colunas de itens (Quantidade, Produtos, CFOPs, NCMs)
  const COLUNAS_ITENS = ["itensQuantidade", "itensProdutos", "itensCFOPs", "itensNCMs"];
  function syncIncluirItens() {
    if (f_incluirItens.checked) {
      for (const k of COLUNAS_ITENS) {
        if (campoChecks[k]) campoChecks[k].checked = true;
      }
      toast("✓ Colunas de itens adicionadas (Qtd, Produtos, CFOPs, NCMs)");
    }
    updateCount();
  }
  f_incluirItens.onchange = syncIncluirItens;

  // ---- Formato (cards visuais) ----
  const f_formato = el("div", { class: "formato-grid" });
  let formatoAtual = "xlsx";
  for (const f of FORMATOS) {
    const card = el("button", {
      class: `formato-card ${f.value === "xlsx" ? "is-selected" : ""}`,
      "data-formato": f.value,
      onClick: () => {
        formatoAtual = f.value;
        for (const c of f_formato.querySelectorAll(".formato-card")) {
          c.classList.toggle("is-selected", c.dataset.formato === f.value);
        }
      },
      type: "button",
    },
      el("div", { class: "formato-card__icon", style: `background:${f.cor}` }, f.icon),
      el("div", { class: "formato-card__label" }, f.label),
      el("div", { class: "formato-card__ext" }, `.${f.ext}`),
    );
    f_formato.appendChild(card);
  }

  // ====== TEMPLATES POR MÓDULO (cards clicáveis) ======
  const tplCardsHost = el("div", { class: "tpl-grid" });
  function buildTplCards() {
    tplCardsHost.innerHTML = "";
    const tpls = [
      ...(TEMPLATES_MODULOS.NFE || []).map((t) => ({ ...t, mod: "NF-e" })),
      ...(TEMPLATES_MODULOS.CTE || []).map((t) => ({ ...t, mod: "CT-e" })),
      ...(TEMPLATES_MODULOS.GERAIS || []).map((t) => ({ ...t, mod: "Geral" })),
    ];
    if (!tpls.length) {
      tplCardsHost.appendChild(el("div", { class: "empty", style: "grid-column:1/-1" },
        "Nenhum template pré-definido disponível."));
      return;
    }
    for (const t of tpls) {
      const card = el("button", {
        class: "tpl-card",
        onClick: () => {
          for (const [k, c] of Object.entries(campoChecks)) c.checked = t.campos.includes(k);
          tplCardsHost.querySelectorAll(".tpl-card").forEach((c) => c.classList.remove("is-active"));
          card.classList.add("is-active");
          toast(`✓ Template "${t.nome}" aplicado`);
        },
        type: "button",
      },
        el("div", { class: "tpl-card__head" },
          el("span", { class: "tpl-card__icon" }, t.mod === "NF-e" ? "📋" : t.mod === "CT-e" ? "🚚" : "📊"),
          el("span", { class: "tpl-card__mod" }, t.mod),
        ),
        el("div", { class: "tpl-card__name" }, t.nome),
        el("div", { class: "tpl-card__meta" },
          el("span", {}, `${t.campos.length} colunas`),
          t.descricao ? el("span", { title: t.descricao }, "ℹ") : null,
        ),
      );
      tplCardsHost.appendChild(card);
    }
  }

  // ---- Seletor de colunas (com busca) ----
  const f_filtroCampo = el("input", { class: "input", placeholder: "🔍 Filtrar colunas (ex: ICMS, CNPJ, valor)..." });
  const fieldsHost = el("div", { class: "campos-grid" });
  const campoChecks = {};
  const campoLabels = {};
  for (const c of TODOS_CAMPOS) {
    campoLabels[c.key] = c.label;
    const chk = el("input", { type: "checkbox", id: `fld-${c.key}` });
    campoChecks[c.key] = chk;
    const labelEl = el("label", { class: "campo-check", "data-key": c.key, for: `fld-${c.key}` },
      chk,
      el("span", {}, ` ${c.label}`),
    );
    fieldsHost.appendChild(labelEl);
  }
  f_filtroCampo.oninput = () => {
    const q = f_filtroCampo.value.trim().toLowerCase();
    for (const [k, lbl] of Object.entries(campoLabels)) {
      const label = (k + " " + lbl).toLowerCase();
      const row = fieldsHost.querySelector(`[data-key="${k}"]`);
      if (!row) continue;
      row.style.display = !q || label.includes(q) ? "" : "none";
    }
  };
  const btnAll = el("button", { class: "toolbar__btn toolbar__btn--ghost", onClick: () => setAll(true), type: "button" }, "✓ Marcar todos");
  const btnNone = el("button", { class: "toolbar__btn toolbar__btn--ghost", onClick: () => setAll(false), type: "button" }, "✗ Desmarcar");
  const btnInv = el("button", { class: "toolbar__btn toolbar__btn--ghost", onClick: () => setAll(null), type: "button" }, "⇄ Inverter");
  const camposCount = el("span", { class: "campos-count", id: "campos-count" }, `0/${TODOS_CAMPOS.length}`);
  function updateCount() {
    const n = Object.values(campoChecks).filter((c) => c.checked).length;
    if (camposCount) camposCount.textContent = `${n}/${TODOS_CAMPOS.length}`;
  }
  function setAll(val) {
    for (const [k, c] of Object.entries(campoChecks)) {
      const row = fieldsHost.querySelector(`[data-key="${k}"]`);
      if (row && row.style.display === "none") continue;
      if (val === null) c.checked = !c.checked; else c.checked = val;
    }
    updateCount();
  }
  // Sincroniza contagem ao clicar em qualquer campo
  fieldsHost.addEventListener("change", updateCount);

  f_kind.onchange = buildTplCards;

  const status = el("div", { class: "rel-status", id: "rel-status" });

  // ====== LAYOUT: 3 cards lado-a-lado ======
  const layout = el("div", { class: "rel-layout" });

  // ---- Card 1: FILTROS (compacto) ----
  const cardFiltros = el("div", { class: "card card--mod", "data-mod": "relatorios" },
    el("div", { class: "card__head" },
      el("h2", {}, el("span", { style: "margin-right:6px" }, "🎯"), "Filtros"),
    ),
    el("div", { class: "card__body" },
      el("div", { class: "form-grid" },
        el("div", { class: "field field--full" }, el("label", {}, "Tipo"), f_kind),
        el("div", { class: "field field--full" }, el("label", {}, "Status"), f_status),
        el("div", { class: "field" }, el("label", {}, "UF"), f_uf),
        el("div", { class: "field" }, el("label", {}, "De"), f_from),
        el("div", { class: "field" }, el("label", {}, "Até"), f_to),
        el("div", { class: "field" }, el("label", {}, "Buscar"), f_q),
      ),
      el("label", { class: "checkbox", style: "margin-top:14px; display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--bg-2); border-radius:6px; cursor:pointer" },
        f_incluirItens,
        el("span", { style: "font-size:12.5px" }, "📦 Incluir itens (1 linha por produto)"),
      ),
    ),
  );

  // ---- Card 2: TEMPLATES ----
  const cardTemplates = el("div", { class: "card card--mod", "data-mod": "relatorios" },
    el("div", { class: "card__head" },
      el("h2", {}, el("span", { style: "margin-right:6px" }, "📋"), "Templates pré-definidos"),
    ),
    el("div", { class: "card__body" },
      tplCardsHost,
    ),
  );

  // ---- Card 3: COLUNAS + AÇÃO (compacto) ----
  const cardColunas = el("div", { class: "card card--mod", "data-mod": "relatorios" },
    el("div", { class: "card__head" },
      el("h2", {},
        el("span", { style: "margin-right:6px" }, "🔧"),
        "Colunas ",
        camposCount,
      ),
      el("div", { style: "display:flex; gap:4px" }, btnAll, btnNone, btnInv),
    ),
    el("div", { class: "card__body" },
      f_filtroCampo,
      fieldsHost,
      el("div", { style: "margin-top:14px" },
        el("h3", { style: "margin:0 0 8px; font-size:12.5px; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em" }, "Formato de saída"),
        f_formato,
      ),
      el("div", { style: "margin-top:14px; display:flex; gap:8px" },
        el("button", { class: "toolbar__btn toolbar__btn--primary", onClick: gerar, type: "button", style: "flex:1; justify-content:center; padding:11px" },
          el("span", { style: "font-size:16px" }, "⚡"),
          el("span", {}, "Gerar relatório"),
        ),
        el("button", { class: "toolbar__btn", onClick: () => saveAsTemplate(), type: "button", title: "Salvar como template" },
          el("span", { style: "font-size:16px" }, "💾"),
        ),
      ),
      status,
    ),
  );

  layout.appendChild(cardFiltros);
  layout.appendChild(cardTemplates);
  layout.appendChild(cardColunas);
  root.appendChild(layout);

  buildTplCards();

  // Listener para aplicar template vindo de "Meus templates > Usar"
  window.addEventListener("cordeiro:applyTemplate", (ev) => {
    const t = ev.detail || {};
    // Filtros
    if (t.filtros) {
      if (t.filtros.kind != null) f_kind.value = t.filtros.kind;
      if (t.filtros.status != null) f_status.value = t.filtros.status;
      if (t.filtros.uf != null) f_uf.value = t.filtros.uf;
      if (t.filtros.dateFrom != null) f_from.value = t.filtros.dateFrom;
      if (t.filtros.dateTo != null) f_to.value = t.filtros.dateTo;
      if (t.filtros.q != null) f_q.value = t.filtros.q;
      buildTplCards();
    }
    // Campos: desmarca todos, marca os do template
    for (const [, c] of Object.entries(campoChecks)) c.checked = false;
    for (const k of (t.campos || [])) {
      if (campoChecks[k]) campoChecks[k].checked = true;
    }
    updateCount();
    // Incluir-itens
    if (t.incluir_itens != null) f_incluirItens.checked = !!t.incluir_itens;
  });

  function params() {
    const p = new URLSearchParams();
    for (const [k, v] of [["kind", f_kind], ["status", f_status], ["uf", f_uf], ["dateFrom", f_from], ["dateTo", f_to], ["q", f_q]]) {
      if (v.value) p.set(k, v.value);
    }
    if (f_incluirItens.checked) p.set("itens", "1");
    return p;
  }
  function camposSelecionados() {
    const out = [];
    for (const [k, c] of Object.entries(campoChecks)) {
      const row = fieldsHost.querySelector(`[data-key="${k}"]`);
      if (row && row.style.display === "none") continue;
      if (c.checked) out.push(k);
    }
    return out;
  }
  async function gerar() {
    const p = params();
    const campos = camposSelecionados();
    if (campos.length) p.set("campos", campos.join(","));
    const f = formatoAtual;
    const url = f === "csv" ? "/api/relatorio/csv"
              : f === "pdf" ? "/api/relatorio/pdf"
              : f === "zip" ? "/api/relatorio/lote"
              : "/api/relatorio/xlsx";
    if (f === "zip") p.set("formato", "xml_pdf");
    status.className = "rel-status rel-status--loading";
    status.textContent = "⏳ Gerando...";
    try {
      await apiDownload(url + "?" + p.toString(), `relatorio-${Date.now()}.${f}`);
      status.className = "rel-status rel-status--ok";
      status.textContent = "✓ Download iniciado!";
    } catch (e) {
      status.className = "rel-status rel-status--err";
      status.textContent = "✕ Erro: " + e.message;
    }
  }
  async function saveAsTemplate() {
    const nome = prompt("Nome do template:");
    if (!nome) return;
    const descricao = prompt("Descrição (opcional):") || null;
    const compartilhar = confirm("Compartilhar com todos os usuários?");
    try {
      await api("/api/relatorio/templates", { method: "POST", body: {
        nome, descricao, compartilhar,
        campos: camposSelecionados(),
        filtros: Object.fromEntries(params()),
        incluir_itens: f_incluirItens.checked,
      }});
      toast("✓ Template salvo!");
    } catch (e) { toast(e.message, "err"); }
  }
}

function sel(value, opts) {
  const s = el("select", { class: "select" });
  for (const [v, l] of opts) s.appendChild(el("option", { value: v }, l));
  s.value = value;
  return s;
}
