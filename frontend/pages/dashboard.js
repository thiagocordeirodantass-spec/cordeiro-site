// =============================================================================
//  pages/dashboard.js — Dashboard minimalista estilo SiscoFiscal
//  -----------------------------------------------------------------------------
//  - Hero com saudação contextual (período do dia + nome) — sem números
//  - Card único: Mundo Fiscal — Reforma Tributária (feed de notícias)
// =============================================================================
import { api, el, navigate } from "../assets/app.js";
import { ICONS } from "../assets/cordeiro.js";

function saudacao() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export async function render(root) {
  const u = window.__CORDEIRO_USER__;
  const empresa = window.__CORDEIRO_EMPRESA__;

  // ---- Topbar com breadcrumb ----
  root.appendChild(el("div", { class: "topbar" },
    el("div", { class: "crumbs" },
      el("span", {}, "Início"),
      el("span", { class: "sep" }, "›"),
      el("strong", {}, "Dashboard"),
    ),
    el("div", { class: "topbar__actions" },
      el("button", { class: "toolbar__btn toolbar__btn--ghost", onClick: () => location.reload() }, "🔄 Atualizar"),
    ),
  ));

  // ---- HERO com saudação (sem números) ----
  const hero = el("div", {
    class: "card card--mod fade-in",
    "data-mod": "dashboard",
    style: "background:linear-gradient(135deg, #0e7c66 0%, #075c4b 100%); color:#fff; border:none; margin-bottom:18px; padding:32px 28px",
  },
    el("div", { class: "card__body" },
      el("div", { style: "display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px" },
        el("div", {},
          el("div", { style: "font-size:13px; opacity:0.85; text-transform:uppercase; letter-spacing:0.06em; font-weight:600" }, `${saudacao()},`),
          el("h1", { style: "margin:4px 0 6px; font-size:32px; font-weight:700" }, `${u?.nome?.split(" ")[0] || "visitante"} 🐑`),
          el("div", { style: "font-size:14px; opacity:0.9" },
            empresa?.nome ? `Você está em ${empresa.nome}` : "Selecione uma empresa para começar",
            empresa?.cnpj ? ` · ${empresa.cnpj}` : "",
          ),
        ),
      ),
    ),
  );
  root.appendChild(hero);

  // ---- Card único: Mundo Fiscal ----
  root.appendChild(renderNoticias());

  loadNews();
}

function renderNoticias() {
  return el("div", { class: "card card--mod fade-in-1", "data-mod": "dashboard" },
    el("div", { class: "card__head" },
      el("h2", { html: ICONS.news + '<span>Mundo Fiscal — Reforma Tributária</span>' }),
      el("a", {
        href: "https://www.gov.br/receitafederal/pt-br/assuntos/reforma-tributaria",
        target: "_blank",
        rel: "noopener",
        class: "btn btn--sm",
      }, "Ver mais →"),
    ),
    el("div", { class: "card__body", id: "news-body" },
      el("div", { class: "empty" },
        el("div", { class: "spinner" }), " Carregando notícias…"
      )
    ),
  );
}

async function loadNews() {
  const body = document.getElementById("news-body");
  if (!body) return;
  try {
    const r = await api("/api/news");
    const curadas = r.curadas || [];
    const externos = r.externos || [];

    body.innerHTML = "";
    const grid = el("div", { class: "news-grid" });
    body.appendChild(grid);

    if (curadas.length) {
      const feat = curadas[0];
      grid.appendChild(renderNewsCard(feat, true));
    }
    for (const n of curadas.slice(1, 4)) {
      grid.appendChild(renderNewsCard(n, false));
    }
    for (const n of externos.slice(0, 2)) {
      grid.appendChild(renderNewsCard({ ...n, tag: "novo", tagLabel: "MANCHETE" }, false));
    }
    if (!curadas.length && !externos.length) {
      body.innerHTML = '<div class="empty">Nenhuma notícia disponível no momento.</div>';
    }
  } catch (e) {
    body.innerHTML = '<div class="empty">Não foi possível carregar as notícias. ' + e.message + '</div>';
  }
}

function renderNewsCard(n, featured) {
  const tagClass = n.tag === "alerta" ? "tag--alerta" : n.tag === "reforma" ? "tag--reforma" : "tag--novo";
  return el("a", {
    href: n.url || "#",
    target: "_blank",
    rel: "noopener",
    class: `news-card ${featured ? "featured" : ""} fade-in`,
    style: "text-decoration:none; color:inherit",
  },
    el("div", { class: `tag ${tagClass}` }, n.tagLabel || "NOTÍCIA"),
    el("h3", {}, n.titulo),
    el("p", {}, n.resumo || ""),
    el("div", { class: "meta" },
      el("span", { class: "src" }, n.fonte || "—"),
      el("span", {}, "•"),
      el("span", {}, n.data ? new Date(n.data).toLocaleDateString("pt-BR") : ""),
    ),
  );
}
