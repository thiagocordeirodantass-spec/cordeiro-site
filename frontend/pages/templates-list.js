// =============================================================================
//  pages/templates-list.js — gerenciar templates salvos (componente)
//  -----------------------------------------------------------------------------
//  Agora é importado por relatorios.js para a aba "Meus templates".
//  Mantém compatibilidade: a função render(root) ainda funciona se
//  chamado direto (deep-link antigo).
// =============================================================================
import { api, toast, el, fmtDate } from "../assets/app.js";

export async function render(root) {
  root.appendChild(el("div", { class: "topbar" }, el("div", { class: "crumbs" }, el("strong", {}, "Templates salvos"))));
  const host = el("div", { class: "card" }, el("div", { class: "card__body" }));
  root.appendChild(host);
  await renderTemplatesTab(host);
}

export async function renderTemplatesTab(host) {
  await reload();

  async function reload() {
    let templates = [];
    try { templates = await api("/api/relatorio/templates"); } catch (e) { toast(e.message, "err"); return; }
    if (!templates.length) {
      host.innerHTML = "";
      host.appendChild(el("div", { class: "empty", style: "padding:30px; text-align:center; color:var(--sisco-text-muted, #7a869a)" },
        "Nenhum template salvo ainda. Crie em \"Gerar relatórios\"."
      ));
      return;
    }
    host.innerHTML = "";
    const t = el("table", { class: "sisco-table" },
      el("thead", {}, el("tr", {},
        el("th", {}, "Nome"), el("th", {}, "Autor"), el("th", {}, "Campos"),
        el("th", {}, "Compartilhar"), el("th", {}, "Atualizado"),
        el("th", {}, "Ações"),
      )),
      el("tbody", {}, ...templates.map(row)),
    );
    const wrap = el("div", { class: "sisco-table-wrap" },
      el("div", { class: "sisco-table-head" },
        el("h2", {}, `Meus templates salvos (${templates.length})`),
      ),
      t,
    );
    host.appendChild(wrap);
  }

  function row(t) {
    return el("tr", {},
      el("td", {}, t.nome, t.descricao ? el("div", { class: "kv__label", style: "margin-top:2px" }, t.descricao) : null),
      el("td", {}, t.autor_nome || t.autor_username || "-"),
      el("td", {}, (t.campos || []).join(", ")),
      el("td", {}, t.compartilhar ? el("span", { class: "sisco-badge sisco-badge--ok" }, "★ sim") : el("span", { class: "sisco-badge sisco-badge--gray" }, "não")),
      el("td", {}, fmtDate(t.updated_at)),
      el("td", { class: "row-actions" },
        el("button", { onClick: () => useTemplate(t) }, "▶ Usar"),
        " ",
        el("button", { class: "btn--danger", onClick: () => removeT(t) }, "🗑"),
      ),
    );
  }
  function useTemplate(t) {
    // Salva o template escolhido num "slot" global para o relatorios.js ler
    // ao montar, e navega para a aba "Gerar".
    sessionStorage.setItem("cordeiro:applyTemplate", JSON.stringify(t));
    location.hash = "#/relatorios";
  }
  async function removeT(t) {
    if (!confirm(`Excluir template "${t.nome}"?`)) return;
    try { await api(`/api/relatorio/templates/${t.id}`, { method: "DELETE" }); toast("Removido"); await reload(); }
    catch (e) { toast(e.message, "err"); }
  }
}
