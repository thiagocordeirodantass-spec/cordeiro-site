// =============================================================================
//  pages/select-empresa.js — seletor de empresa (fullscreen, com gradiente)
//  -----------------------------------------------------------------------------
//  Tela cheia (sem shell) com cards grandes, gradiente, animações.
// =============================================================================
import { api, toast, el, state } from "../assets/app.js";

function formatCnpj(cnpj) {
  const d = String(cnpj || "").replace(/\D/g, "").padStart(14, "0");
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export async function render(root) {
  // Limpa o shell (se houver) — esta página é fullscreen
  document.querySelector(".app")?.remove();
  document.querySelector(".hamburger")?.remove();
  document.querySelector(".toast-host")?.remove();
  document.getElementById("app-root").innerHTML = "";

  let empresas = [];
  try {
    const r = await api("/api/empresas");
    empresas = r.empresas || [];
  } catch (e) {
    empresas = [];
  }

  const isSuper = state.user?.is_super_admin;
  const u = state.user;

  // ---- Background decorado com gradiente + formas ----
  const bg = el("div", { class: "select-bg" });
  document.getElementById("app-root").appendChild(bg);

  // ---- Container principal ----
  const container = el("div", { class: "select-container scale-in" });
  document.getElementById("app-root").appendChild(container);

  // ---- Header com logo e saudação ----
  const initials = (u?.nome || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  container.appendChild(el("div", { class: "select-header" },
    el("div", { class: "select-header__logo" },
      el("div", { class: "logo-cordeiro" }),
    ),
    el("div", { class: "select-header__text" },
      el("div", { class: "select-header__saudacao" }, `${saudacao()}, ${u?.nome?.split(" ")[0] || "visitante"}! 👋`),
      el("h1", {}, "Selecione uma empresa"),
      el("p", {},
        isSuper
          ? "Você é administrador global. Escolha qual empresa deseja acessar."
          : "Escolha qual empresa você quer acessar agora. Você pode trocar depois.",
      ),
    ),
    el("div", { class: "select-header__user" },
      el("div", { class: "select-header__avatar" }, initials),
      isSuper ? el("span", { class: "select-header__role" }, "ADMIN GLOBAL") : el("span", { class: "select-header__role select-header__role--user" }, u?.role || "user"),
    ),
  ));

  // ---- Empty state ou grid de cards ----
  if (empresas.length === 0) {
    container.appendChild(el("div", { class: "card select-empty fade-in" },
      el("div", { class: "select-empty__icon" }, "🏢"),
      el("h2", {}, "Nenhuma empresa vinculada"),
      el("p", {}, "Você ainda não está vinculado a nenhuma empresa."),
      isSuper
        ? el("a", { href: "#/admin-empresas", class: "toolbar__btn toolbar__btn--primary", style: "margin-top:14px" },
            el("span", {}, "🏢"), el("span", {}, "Cadastrar primeira empresa"),
          )
        : el("p", { style: "margin-top:14px" },
            "Fale com o administrador da empresa para que ele vincule você.",
          ),
    ));
  } else {
    const grid = el("div", { class: "empresa-grid" });
    empresas.forEach((e, idx) => {
      const card = el("button", {
        class: "empresa-card fade-in",
        style: `animation-delay: ${idx * 0.07}s`,
        onClick: () => ativar(e),
        type: "button",
      },
        // Badge de ambiente
        e.ambiente === "producao"
          ? el("div", { class: "empresa-card__env empresa-card__env--prod" },
              el("span", { class: "empresa-card__env-dot" }), "PRODUÇÃO",
            )
          : el("div", { class: "empresa-card__env empresa-card__env--homo" },
              el("span", { class: "empresa-card__env-dot" }), "HOMOLOGAÇÃO",
            ),
        // Ícone
        el("div", { class: "empresa-card__icon" },
          (e.nome || "E").slice(0, 1).toUpperCase(),
        ),
        // Conteúdo
        el("div", { class: "empresa-card__body" },
          el("div", { class: "empresa-card__name" }, e.nome || `Empresa ${e.id}`),
          el("div", { class: "empresa-card__cnpj" }, formatCnpj(e.cnpj)),
          e.regime_tributario
            ? el("div", { class: "empresa-card__regime" },
                el("span", { class: "empresa-card__regime-icon" }, "📋"),
                e.regime_tributario,
              )
            : null,
          ifExists(e.uf, (uf) => el("div", { class: "empresa-card__uf" },
            el("span", { class: "empresa-card__uf-icon" }, "📍"),
            `${uf}${e.municipio ? " · " + e.municipio : ""}`,
          )),
        ),
        // Seta
        el("div", { class: "empresa-card__arrow" }, "→"),
      );
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  // ---- Footer com ações ----
  const footer = el("div", { class: "select-footer" },
    isSuper ? el("a", { href: "#/admin-empresas", class: "toolbar__btn toolbar__btn--ghost" },
      el("span", { style: "font-size:16px" }, "➕"),
      el("span", {}, "Cadastrar nova empresa"),
    ) : null,
    el("a", { href: "#/profile", class: "toolbar__btn toolbar__btn--ghost" },
      el("span", { style: "font-size:16px" }, "👤"),
      el("span", {}, "Meu perfil"),
    ),
    el("button", { class: "toolbar__btn toolbar__btn--ghost", onClick: () => { api("/api/logout", { method: "POST" }).then(() => location.hash = "#/login"); } },
      el("span", { style: "font-size:16px" }, "🚪"),
      el("span", {}, "Sair"),
    ),
    el("span", { style: "flex:1" }),
    el("span", { class: "select-footer__brand" },
      el("span", { class: "select-footer__logo" }),
      el("span", {}, "Cordeiro Fiscal · v0.1 · 2026"),
    ),
  );
  container.appendChild(footer);

  async function ativar(e) {
    try {
      await api(`/api/empresas/${e.id}/ativar`, { method: "POST" });
      toast(`✓ Empresa "${e.nome}" ativada`);
      location.hash = "#/dashboard";
      location.reload();
    } catch (err) {
      toast(err.message || "Erro", "err");
    }
  }
}

function ifExists(value, fn) {
  if (value && String(value).trim()) return fn(value);
  return null;
}
