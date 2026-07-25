// =============================================================================
//  assets/app.js — shell, roteador hash, estado de sessão, fetch wrapper
// =============================================================================

import { logoCordeiro, ICONS, devBanner, consultaBanner, CORDEIRO_SVG } from "./cordeiro.js";

const root = document.getElementById("app-root");

const state = {
  user: null,
  page: null,
  loadedPages: new Map(),
  empresa: null,         // empresa ativa { id, nome, cnpj, papel, ambiente, ... } ou null
  empresas: [],          // lista para o seletor
};
export { state };

// ---- Helpers ----
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") node.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") node.innerHTML = v;
    else if (v === false || v == null) continue;
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function fmtMoney(v) {
  const n = Number(v);
  if (!isFinite(n)) return v ?? "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function fmtDate(s) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d)) return String(s);
  return d.toLocaleString("pt-BR");
}
export function fmtDateShort(s) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d)) return String(s);
  return d.toLocaleDateString("pt-BR");
}

export function statusBadge(status) {
  const cls = status === "autorizado" ? "badge--ok"
    : status === "cancelado" ? "badge--cancel"
    : status === "denegado" || status === "rejeitado" ? "badge--cancel"
    : "badge--pending";
  return `<span class="badge ${cls}">${status || "pendente"}</span>`;
}

export function toast(msg, kind = "ok") {
  let host = document.querySelector(".toast-host");
  if (!host) {
    host = el("div", { class: "toast-host" });
    document.body.appendChild(host);
  }
  const t = el("div", { class: `toast toast--${kind}` }, msg);
  host.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity 0.3s"; }, 2700);
  setTimeout(() => t.remove(), 3200);
}

export function showModal({ title, body, footer, wide = false, onClose = null, onOpen = null }) {
  const close = () => { backdrop.remove(); if (onClose) onClose(); };
  const backdrop = el("div", { class: "modal-backdrop", onClick: (e) => { if (e.target === backdrop) close(); } });
  const modal = el("div", { class: `modal ${wide ? "modal--wide" : ""}` },
    el("div", { class: "modal__head" },
      el("h3", {}, title),
      el("button", { class: "btn btn--ghost btn--icon", onClick: close }, "×")
    ),
    el("div", { class: "modal__body" }, body),
    footer ? el("div", { class: "modal__foot" }, footer) : null,
  );
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  if (onOpen) {
    try { onOpen(); } catch (e) { console.error("showModal onOpen error:", e); }
  }
  return { close, modal };
}

async function api(path, options = {}) {
  const opts = { credentials: "same-origin", ...options };
  if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
    opts.headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    opts.body = JSON.stringify(opts.body);
  }
  // Envia header X-Empresa-Id (opcional) para o backend saber qual tenant usar
  if (state.empresa && state.empresa.id && !path.includes("/api/auth/") && !path.includes("/api/empresas")) {
    opts.headers = { ...(opts.headers || {}), "X-Empresa-Id": String(state.empresa.id) };
  }
  const r = await fetch(path, opts);
  if (r.status === 401) {
    // 401 em /api/auth/* é erro de credenciais — não redireciona nem desloga
    if (!path.includes("/api/auth/")) {
      state.user = null;
      navigate("login");
    }
    let msg = "Não autenticado";
    try { const j = await r.json(); if (j.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  // 409 com code=no_tenant = precisa selecionar empresa
  if (r.status === 409) {
    let body = null;
    try { body = await r.json(); } catch (e) {}
    if (body && body.code === "no_tenant") {
      navigate("select-empresa");
      throw new Error(body.error || "Selecione uma empresa");
    }
  }
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const j = await r.json(); msg = j.error || msg; } catch (e) {}
    throw new Error(msg);
  }
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) return r.json();
  return r;
}
export { api };

export async function apiDownload(path, filename) {
  const headers = {};
  if (state.empresa && state.empresa.id && !path.includes("/api/auth/")) {
    headers["X-Empresa-Id"] = String(state.empresa.id);
  }
  const r = await fetch(path, { credentials: "same-origin", headers });
  if (r.status === 401) { state.user = null; navigate("login"); throw new Error("Não autenticado"); }
  if (r.status === 409) {
    let body = null; try { body = await r.json(); } catch (e) {}
    if (body && body.code === "no_tenant") { navigate("select-empresa"); throw new Error(body.error || "Selecione uma empresa"); }
  }
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { msg = (await r.json()).error || msg; } catch (e) {}
    throw new Error(msg);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename || "download", style: "display:none" });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function avatarEl(user, size = "") {
  const cls = `avatar ${size}`;
  const a = el("div", { class: cls });
  if (user && user.avatar_url) {
    const img = el("img", { src: user.avatar_url, alt: user.nome || user.username });
    a.appendChild(img);
  } else {
    const initials = (user?.nome || user?.username || "??").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
    a.textContent = initials;
  }
  return a;
}

// =============================================================================
//  ROTEADOR
// =============================================================================
const PAGES = {
  login: { module: () => import("../pages/login.js"), public: true },
  register: { module: () => import("../pages/register.js"), public: true },
  dashboard: { module: () => import("../pages/dashboard.js") },
  documents: { module: () => import("../pages/documents-list.js") },
  import: { module: () => import("../pages/import.js") },
  "portal-nacional": { module: () => import("../pages/portal-nacional.js") },
  "sefaz-download": { module: () => import("../pages/sefaz-download.js") },
  "sefaz-monitor": { module: () => import("../pages/sefaz-monitor.js") },
  meudanfe: { module: () => import("../pages/meudanfe.js") },
  relatorios: { module: () => import("../pages/relatorios.js") },
  "select-empresa": { module: () => import("../pages/select-empresa.js") },
  "admin-empresas": { module: () => import("../pages/admin-empresas.js"), admin: true },
  audit: { module: () => import("../pages/audit-log.js") },
  profile: { module: () => import("../pages/profile.js") },
  feedback: { module: () => import("../pages/feedback.js") },
  users: { module: () => import("../pages/admin-users.js"), admin: true },
  "mail-config": { module: () => import("../pages/mail-config.js"), admin: true },
  "change-password": { module: () => import("../pages/change-password.js") },
};

const NAV = [
  { section: "Principal", items: [
    { key: "dashboard", label: "Início", icon: "dashboard" },
    { key: "documents", label: "Documentos", icon: "documents" },
  ]},
  { section: "Integrações", items: [
    { key: "import", label: "Importar XML", icon: "import", oper: true },
    { key: "portal-nacional", label: "Portal Nacional", icon: "portal" },
    { key: "sefaz-download", label: "Baixar do SEFAZ", icon: "sefaz", oper: true },
    { key: "sefaz-monitor", label: "Monitor SEFAZ", icon: "sefaz" },
    { key: "meudanfe", label: "MeuDANFe API", icon: "meudanfe" },
  ]},
  { section: "Relatórios", items: [
    { key: "relatorios", label: "Gerar relatórios", icon: "relatorios" },
    { key: "audit", label: "Histórico / Auditoria", icon: "audit" },
  ]},
  { section: "Comunidade", items: [
    { key: "feedback", label: "Feedback / Sugestões", icon: "feedback" },
  ]},
  { section: "Administração", admin: true, items: [
    { key: "users", label: "Usuários", icon: "users" },
    { key: "admin-empresas", label: "Empresas", icon: "empresas" },
    { key: "mail-config", label: "Email (SMTP)", icon: "news" },
  ]},
];

export function navigate(page) {
  location.hash = `#/${page}`;
}

async function carregarSessao() {
  const me = await api("/api/auth/me");
  state.user = me.user;
  window.__CORDEIRO_USER__ = me.user;
  // popula empresa ativa e lista de empresas
  state.empresa = me.user.empresa_ativa || null;
  state.empresas = me.user.memberships || [];
  // super-admin sem membership na ativa: busca a empresa ativa via API dedicada
  if (!state.empresa && me.user.empresa_ativa_id && me.user.is_super_admin) {
    try {
      const r = await api(`/api/empresas/${me.user.empresa_ativa_id}`);
      if (r && r.empresa) {
        state.empresa = {
          empresa_id: r.empresa.id,
          id: r.empresa.id,
          nome: r.empresa.nome,
          cnpj: r.empresa.cnpj,
          ambiente: r.empresa.ambiente,
          papel: "admin",
        };
      }
    } catch (e) {}
  }
  // super-admin: lista todas (não só memberships)
  if (me.user.is_super_admin) {
    try {
      const r = await api("/api/empresas");
      state.empresas = (r.empresas || []).map((e) => ({
        empresa_id: e.id,
        nome: e.nome,
        cnpj: e.cnpj,
        ambiente: e.ambiente,
        papel: "admin",
      }));
    } catch (e) {}
  }
  // expõe a empresa ativa para o dashboard/páginas que quiserem
  window.__CORDEIRO_EMPRESA__ = state.empresa;
}

async function mountPage(page) {
  if (!PAGES[page]) page = "dashboard";
  if (page === "login" || page === "register") {
    root.innerHTML = "";
    const mod = await PAGES[page].module();
    await mod.render(root);
    return;
  }
  if (!state.user) {
    try {
      await carregarSessao();
    } catch (e) {
      navigate("login");
      return;
    }
  }
  // Verifica se precisa selecionar empresa (pula se a página for de seleção)
  const precisaEmpresa = page !== "select-empresa" && page !== "change-password";
  if (precisaEmpresa && !state.empresa) {
    navigate("select-empresa");
    return;
  }
  if (state.user.primeiro_login && page !== "change-password") {
    navigate("change-password");
    return;
  }
  if (PAGES[page].admin && state.user.role !== "admin") {
    toast("Acesso restrito a administradores", "err");
    navigate("dashboard");
    return;
  }
  renderShell(page);
  const mod = await PAGES[page].module();
  const pageRoot = document.getElementById("page-root");
  if (!pageRoot) {
    console.error("[mountPage] pageRoot nao encontrado! page=", page, "root html=", root.innerHTML.slice(0, 300));
    return;
  }
  pageRoot.innerHTML = "";
  await mod.render(pageRoot);
  document.querySelectorAll(".side__nav a").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.page === page);
  });
}

function setSidebarOpen(open) {
  const appEl = document.querySelector(".app");
  const side = document.querySelector(".app-sidebar");
  const backdrop = document.querySelector(".side-backdrop");
  if (!appEl || !side) return;

  const isMobile = window.innerWidth <= 900;

  if (isMobile) {
    // Mobile: drawer
    appEl.classList.toggle("app--side-open", !!open);
    if (backdrop) backdrop.classList.toggle("side-backdrop--show", !!open);
  }
  // Desktop: sidebar é fixa e sempre visível (sem botão de colapsar)
}

function renderEmpresaSelector() {
  // Se usuário não tem empresa ativa e não é super-admin, mostra CTA para selecionar
  if (!state.empresa && !state.user.is_super_admin) {
    return el("div", { class: "side__empresa-empty" },
      el("button", { class: "btn btn--sm btn--primary", onClick: () => navigate("select-empresa") }, "+ Selecionar empresa")
    );
  }
  if (!state.empresa && state.user.is_super_admin) {
    return el("div", { class: "side__empresa-empty" },
      el("button", { class: "btn btn--sm", onClick: () => navigate("select-empresa") }, "🏢 Selecionar empresa")
    );
  }

  const e = state.empresa;
  const cor = e.ambiente === "producao" ? "var(--sisco-green, #0e7c66)" : "var(--sisco-yellow, #d4a017)";
  const isMulti = state.empresas.length > 1 || state.user.is_super_admin;

  const main = el("button", {
    class: "side__empresa",
    title: "Trocar empresa",
    onClick: () => openEmpresaDropdown(),
  },
    el("span", { class: "side__empresa-dot", style: `background:${cor}` }),
    el("div", { class: "side__empresa-text" },
      el("strong", {}, e.nome || `Empresa ${e.empresa_id}`),
      el("small", {}, (e.cnpj ? formatCnpj(e.cnpj) + " · " : "") + (e.ambiente === "producao" ? "Produção" : "Homologação")),
    ),
    isMulti ? el("span", { class: "side__empresa-chev" }, "▾") : null,
  );
  return el("div", { class: "side__empresa-wrap" }, main);
}

function openEmpresaDropdown() {
  // dropdown simples: lista de cards via modal pequeno
  const opts = state.empresas.length > 0
    ? state.empresas
    : (state.user.is_super_admin ? state.empresas : []);
  showModal({
    title: "Selecionar empresa",
    body: el("div", { class: "empresa-grid" },
      ...opts.map((e) => el("button", {
        class: "empresa-card" + (e.empresa_id === state.empresa?.empresa_id ? " is-active" : ""),
        onClick: async () => {
          try {
            await trocarEmpresa(e.empresa_id);
            document.querySelector(".modal-backdrop")?.remove();
            // recarrega a página atual (router não consegue recarregar o tenant via state)
            const currentHash = location.hash;
            location.reload();
          } catch (err) { toast(err.message, "err"); }
        },
      },
        el("strong", {}, e.nome || `Empresa ${e.empresa_id}`),
        el("small", {}, e.cnpj ? formatCnpj(e.cnpj) : "—"),
        el("span", { class: "sisco-badge sisco-badge--ok" }, e.papel || "admin"),
        e.ambiente === "producao" ? el("span", { class: "sisco-badge sisco-badge--green" }, "PRODUÇÃO") : null,
      ))
    ),
    footer: [
      el("button", { class: "btn", onClick: () => document.querySelector(".modal-backdrop")?.remove() }, "Cancelar"),
    ],
  });
}

async function trocarEmpresa(empresaId) {
  await api(`/api/empresas/${empresaId}/ativar`, { method: "POST" });
  // Recarrega o estado do user
  const me = await api("/api/auth/me");
  state.user = me.user;
  state.empresa = (me.user.memberships || []).find((m) => m.empresa_id === empresaId) || null;
  return state.empresa;
}

function formatCnpj(cnpj) {
  const d = String(cnpj || "").replace(/\D/g, "").padStart(14, "0");
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function renderShell(page) {
  root.innerHTML = "";
  const u = state.user;
  const isAdmin = u.role === "admin";
  const isOper = u.role === "operador" || isAdmin;

  // --- Banners no topo (em desenvolvimento + somente consulta) ---
  root.appendChild(devBanner());
  root.appendChild(consultaBanner());

  // --- Botão hambúrguer (visível só no mobile via CSS) ---
  const hamburger = el("button", {
    class: "hamburger",
    type: "button",
    title: "Abrir menu",
    "aria-label": "Abrir menu",
    onClick: () => setSidebarOpen(!document.querySelector(".app")?.classList.contains("app--side-open")),
  }, el("span", { class: "hamburger__line" }), el("span", { class: "hamburger__line" }), el("span", { class: "hamburger__line" }));

  // ---- TOP BAR horizontal ----
  const topbar = el("header", { class: "app-topbar" },
    el("div", { class: "app-topbar__brand" },
      el("div", { class: "logo-cordeiro", html: CORDEIRO_SVG }),
      el("div", {},
        el("h1", {}, "Cordeiro"),
        el("small", {}, "Sistema Fiscal"),
      ),
    ),
    el("div", { class: "app-topbar__search" },
      el("input", { type: "search", placeholder: "Buscar NF-e, CT-e, chave de acesso…", id: "global-search" }),
    ),
    el("div", { class: "app-topbar__spacer" }),
    state.empresa ? renderTopbarEmpresa() : null,
    renderTopbarUser(u),
  );

  // ---- SIDEBAR vertical (220px) ----
  const sideSections = [];
  for (const sec of NAV) {
    if (sec.admin && !isAdmin) continue;
    const items = sec.items.filter((it) => !it.oper || isOper).map((it) => {
      const a = el("a", { href: `#/${it.key}`, "data-page": it.key, onClick: (e) => { e.preventDefault(); navigate(it.key); if (window.innerWidth <= 900) setSidebarOpen(false); } });
      a.innerHTML = ICONS[it.icon] || "";
      const lbl = el("span", { class: "label" }, it.label);
      a.appendChild(lbl);
      if (it.key === page) a.classList.add("is-active");
      return a;
    });
    if (!items.length) continue;
    sideSections.push(el("div", {},
      el("div", { class: "app-sidebar__section" }, sec.section),
      el("nav", { class: "app-sidebar__nav" }, ...items),
    ));
  }

  const sidebar = el("aside", { class: "app-sidebar" }, ...sideSections);

  // ---- MAIN ----
  const main = el("main", { class: "app-main", id: "page-root" }, el("div", { class: "splash" }, "Carregando…"));

  // ---- FOOTER de status ----
  const footer = el("footer", { class: "app-footer" },
    el("div", { class: "app-footer__status" },
      el("div", { class: "app-footer__status-item" },
        el("span", { class: "app-footer__status-dot app-footer__status-dot--green" }),
        el("span", {}, "SEFAZ: Online"),
      ),
      el("div", { class: "app-footer__status-item" },
        el("span", { class: "app-footer__status-dot app-footer__status-dot--green" }),
        el("span", {}, "Banco: OK"),
      ),
      el("div", { class: "app-footer__status-item" },
        el("span", { class: "app-footer__status-dot app-footer__status-dot--yellow" }),
        el("span", {}, "Certificado: configurar"),
      ),
    ),
    el("div", { class: "app-footer__version" }, "Cordeiro Sistema Fiscal v0.1 · 2026 · Somente consulta"),
  );

  const backdrop = el("div", {
    class: "side-backdrop",
    onClick: () => setSidebarOpen(false),
  });

  const app = el("div", { class: "app app-shell" }, topbar, sidebar, main, footer);
  root.appendChild(hamburger);
  root.appendChild(app);
  root.appendChild(backdrop);

  // Conecta o campo de busca da top bar ao filtro da página atual (se houver)
  wireGlobalSearch(page);
}

function renderTopbarEmpresa() {
  const e = state.empresa;
  const cor = e.ambiente === "producao" ? "var(--success, #15803d)" : "var(--warn, #b45309)";
  return el("button", {
    class: "app-topbar__empresa",
    type: "button",
    title: "Trocar empresa",
    onClick: openEmpresaDropdown,
  },
    el("span", { class: "app-topbar__empresa-dot", style: `background:${cor}` }),
    el("div", { class: "app-topbar__empresa-text" },
      el("strong", {}, e.nome || `Empresa ${e.empresa_id}`),
      el("small", {}, `${e.cnpj ? formatCnpj(e.cnpj) : "—"} · ${e.ambiente === "producao" ? "Produção" : "Homologação"}`),
    ),
    el("span", { class: "app-topbar__empresa-chev" }, "▾"),
  );
}

function renderTopbarUser(u) {
  return el("div", { class: "app-topbar__user", onClick: () => navigate("profile") },
    avatarEl(u, "sm"),
    el("div", { class: "app-topbar__user-text" },
      el("strong", {}, u.nome || u.username),
      el("small", {}, `${u.username} · ${u.role}`),
    ),
    el("button", { class: "app-topbar__logout", title: "Sair", onClick: (e) => { e.stopPropagation(); doLogout(); }, html: ICONS.exit }),
  );
}

function wireGlobalSearch(page) {
  const input = document.getElementById("global-search");
  if (!input) return;
  // Se a página é "documents" e existe filtro de busca, conecta
  if (page === "documents") {
    setTimeout(() => {
      const f = document.querySelector('input[name="q"], input#f-q, input.filter-q');
      if (f) {
        input.addEventListener("input", (e) => {
          f.value = e.target.value;
          f.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
    }, 200);
  }
  // Outras páginas: enter leva para documents com a busca
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      const q = encodeURIComponent(input.value.trim());
      navigate("documents");
      setTimeout(() => {
        const f = document.querySelector('input[name="q"], input#f-q, input.filter-q');
        if (f) { f.value = input.value.trim(); f.dispatchEvent(new Event("input", { bubbles: true })); }
      }, 200);
    }
  });
}

async function doLogout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch (e) {}
  state.user = null;
  navigate("login");
}

async function checkSession() {
  try {
    await carregarSessao();
    return true;
  } catch (e) {
    return false;
  }
}

async function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const page = hash || "dashboard";
  state.page = page;
  if (page === "login" || page === "register") {
    if (state.user) { navigate("dashboard"); return; }
    await mountPage(page);
    return;
  }
  if (!state.user) {
    const ok = await checkSession();
    if (!ok) { navigate("login"); return; }
  }
  await mountPage(page);
}

window.addEventListener("hashchange", route);
window.addEventListener("load", route);
