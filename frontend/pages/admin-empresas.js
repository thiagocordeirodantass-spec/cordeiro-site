// =============================================================================
//  pages/admin-empresas.js — CRUD de empresas (admin global)
//  -----------------------------------------------------------------------------
//  Tela: lista de todas as empresas + detalhes com abas (Dados, Membros)
// =============================================================================
import { api, toast, el, fmtDate, showModal } from "../assets/app.js";

function formatCnpj(cnpj) {
  const d = String(cnpj || "").replace(/\D/g, "").padStart(14, "0");
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

let TODOS_USUARIOS = [];

export async function render(root) {
  root.appendChild(el("div", { class: "topbar" },
    el("div", { class: "crumbs" }, el("strong", {}, "Empresas")),
    el("div", { class: "topbar__actions" },
      el("button", { class: "btn btn--primary", onClick: () => nova() }, "+ Nova empresa"),
    ),
  ));
  const host = el("div", { class: "card" }, el("div", { class: "card__body" }));
  root.appendChild(host);
  await reload();

  async function reload() {
    let empresas = [];
    try { const r = await api("/api/empresas"); empresas = r.empresas || []; } catch (e) { toast(e.message, "err"); return; }
    if (!empresas.length) {
      host.innerHTML = "";
      host.appendChild(el("div", { class: "empty", style: "padding:30px; text-align:center" },
        el("p", {}, "Nenhuma empresa cadastrada."),
        el("p", { style: "margin-top:8px" },
          el("button", { class: "btn btn--primary", onClick: () => nova() }, "Cadastrar primeira empresa")
        )
      ));
      return;
    }
    host.innerHTML = "";
    const t = el("table", { class: "sisco-table" },
      el("thead", {}, el("tr", {},
        el("th", {}, "Nome"), el("th", {}, "CNPJ"), el("th", {}, "Regime"),
        el("th", {}, "Ambiente"), el("th", {}, "Ativo"),
        el("th", {}, "Cadastrada"),
        el("th", {}, "Ações"),
      )),
      el("tbody", {}, ...empresas.map(row)),
    );
    host.appendChild(el("div", { class: "sisco-table-wrap" },
      el("div", { class: "sisco-table-head" },
        el("h2", {}, `Empresas cadastradas (${empresas.length})`),
      ),
      t,
    ));
  }

  function row(e) {
    return el("tr", {},
      el("td", {},
        el("strong", {}, e.nome),
        e.nome_fantasia ? el("div", { class: "kv__label", style: "margin-top:2px" }, e.nome_fantasia) : null
      ),
      el("td", {}, formatCnpj(e.cnpj)),
      el("td", {}, e.regime_tributario || "-"),
      el("td", {}, e.ambiente === "producao"
        ? el("span", { class: "sisco-badge sisco-badge--green" }, "PRODUÇÃO")
        : el("span", { class: "sisco-badge sisco-badge--gray" }, "Homologação")),
      el("td", {}, e.ativo ? "Sim" : "Não"),
      el("td", {}, fmtDate(e.created_at)),
      el("td", { class: "row-actions" },
        el("button", { class: "btn--sm", onClick: () => verDetalhes(e) }, "👥 Membros"),
        " ",
        el("button", { class: "btn--sm", onClick: () => editar(e) }, "Editar"),
      ),
    );
  }

  function nova() {
    const cnpj = el("input", { class: "input", placeholder: "00.000.000/0001-00" });
    const nome = el("input", { class: "input", placeholder: "Razão social" });
    const nomeFantasia = el("input", { class: "input", placeholder: "Nome fantasia (opcional)" });
    const ie = el("input", { class: "input", placeholder: "IE (opcional)" });
    const regime = el("select", { class: "select" },
      el("option", { value: "" }, "— regime —"),
      el("option", { value: "simples" }, "Simples Nacional"),
      el("option", { value: "presumido" }, "Lucro Presumido"),
      el("option", { value: "real" }, "Lucro Real"),
      el("option", { value: "mei" }, "MEI"),
    );
    const ambiente = el("select", { class: "select" },
      el("option", { value: "homologacao" }, "Homologação"),
      el("option", { value: "producao" }, "Produção"),
    );
    showModal({
      title: "Nova empresa",
      wide: true,
      body: el("div", {},
        field("CNPJ*", cnpj),
        field("Razão Social*", nome),
        field("Nome Fantasia", nomeFantasia),
        field("IE", ie),
        field("Regime Tributário", regime),
        field("Ambiente", ambiente),
      ),
      footer: [
        el("button", { class: "btn", onClick: () => document.querySelector(".modal-backdrop")?.remove() }, "Cancelar"),
        el("button", { class: "btn btn--primary", onClick: async () => {
          try {
            const r = await api("/api/empresas", { method: "POST", body: {
              cnpj: cnpj.value, nome: nome.value, nome_fantasia: nomeFantasia.value,
              ie: ie.value, regime_tributario: regime.value, ambiente: ambiente.value,
            }});
            document.querySelector(".modal-backdrop")?.remove();
            toast("✓ Empresa cadastrada");
            await reload();
            // pergunta se quer vincular membros agora
            setTimeout(() => verDetalhes(r), 200);
          } catch (e) { toast(e.message, "err"); }
        }}, "Criar"),
      ],
    });
  }

  function editar(e) {
    const cnpj = el("input", { class: "input", value: formatCnpj(e.cnpj) });
    cnpj.disabled = true; // CNPJ é PK, não pode mudar
    const nome = el("input", { class: "input", value: e.nome || "" });
    const nomeFantasia = el("input", { class: "input", value: e.nome_fantasia || "" });
    const ie = el("input", { class: "input", value: e.ie || "" });
    const regime = el("select", { class: "select" },
      el("option", { value: "" }, "— regime —"),
      el("option", { value: "simples" }, "Simples Nacional"),
      el("option", { value: "presumido" }, "Lucro Presumido"),
      el("option", { value: "real" }, "Lucro Real"),
      el("option", { value: "mei" }, "MEI"),
    );
    regime.value = e.regime_tributario || "";
    const ambiente = el("select", { class: "select" },
      el("option", { value: "homologacao" }, "Homologação"),
      el("option", { value: "producao" }, "Produção"),
    );
    ambiente.value = e.ambiente || "homologacao";
    const ativo = el("input", { type: "checkbox" });
    ativo.checked = !!e.ativo;
    showModal({
      title: `Editar empresa — ${e.nome}`,
      wide: true,
      body: el("div", {},
        field("CNPJ", cnpj),
        field("Razão Social*", nome),
        field("Nome Fantasia", nomeFantasia),
        field("IE", ie),
        field("Regime Tributário", regime),
        field("Ambiente", ambiente),
        el("label", { class: "checkbox", style: "margin-top:8px" }, ativo, " Ativa"),
      ),
      footer: [
        el("button", { class: "btn", onClick: () => document.querySelector(".modal-backdrop")?.remove() }, "Cancelar"),
        el("button", { class: "btn btn--primary", onClick: async () => {
          try {
            await api(`/api/empresas/${e.id}`, { method: "PUT", body: {
              nome: nome.value, nome_fantasia: nomeFantasia.value,
              ie: ie.value, regime_tributario: regime.value,
              ambiente: ambiente.value, ativo: ativo.checked,
            }});
            document.querySelector(".modal-backdrop")?.remove();
            toast("✓ Empresa atualizada");
            await reload();
          } catch (err) { toast(err.message, "err"); }
        }}, "Salvar"),
      ],
    });
  }

  async function verDetalhes(e) {
    // modal com 2 abas: dados + membros
    const tabs = el("div", { class: "tabs" });
    const panes = {};
    function makeTab(key, label) {
      const b = el("button", { class: "tab-btn", onClick: () => activate(key) }, label);
      tabs.appendChild(b);
      panes[key] = el("div", { class: "tab-pane" });
      panes[key].style.display = "none";
      return b;
    }
    function activate(k) {
      for (const t of tabs.querySelectorAll(".tab-btn")) t.classList.toggle("is-active", t.textContent === panes[k].previousSibling?.textContent);
      for (const [k, p] of Object.entries(panes)) p.style.display = k === k ? "" : "none";
    }
    makeTab("dados", "📋 Dados");
    makeTab("membros", "👥 Membros");

    // ----- Dados -----
    panes.dados.style.display = "";
    panes.dados.appendChild(el("div", { class: "kv" },
      kv("Razão Social", e.nome),
      kv("Nome Fantasia", e.nome_fantasia || "—"),
      kv("CNPJ", formatCnpj(e.cnpj)),
      kv("IE", e.ie || "—"),
      kv("Regime", e.regime_tributario || "—"),
      kv("Ambiente", e.ambiente === "producao" ? "Produção" : "Homologação"),
      kv("Cadastrada em", fmtDate(e.created_at)),
    ));

    // ----- Membros -----
    let membros = [];
    try {
      const r = await api(`/api/empresas/${e.id}/membros`);
      membros = r.membros || [];
    } catch (err) { toast(err.message, "err"); }
    panes.membros.appendChild(el("div", { style: "display:flex; justify-content:space-between; align-items:center; margin-bottom:10px" },
      el("strong", {}, `${membros.length} membro(s) vinculado(s)`),
      el("button", { class: "btn btn--sm btn--primary", onClick: () => vincular(e.id, () => refreshMembros()) }, "+ Vincular usuário"),
    ));
    const membrosList = el("div", { class: "sisco-table-wrap" });
    panes.membros.appendChild(membrosList);
    function renderMembros() {
      if (!membros.length) {
        membrosList.innerHTML = "";
        membrosList.appendChild(el("div", { class: "empty" }, "Nenhum membro vinculado."));
        return;
      }
      membrosList.innerHTML = "";
      membrosList.appendChild(el("table", { class: "sisco-table" },
        el("thead", {}, el("tr", {},
          el("th", {}, "Usuário"), el("th", {}, "Nome"), el("th", {}, "Email"),
          el("th", {}, "Papel"), el("th", {}, "Ativo"),
          el("th", {}, "Ações"),
        )),
        el("tbody", {}, ...membros.map(m => el("tr", {},
          el("td", { class: "mono" }, m.username),
          el("td", {}, m.nome),
          el("td", {}, m.email || "—"),
          el("td", {}, el("span", { class: "sisco-badge sisco-badge--ok" }, m.papel)),
          el("td", {}, m.ativo ? "Sim" : "Não"),
          el("td", { class: "row-actions" },
            el("button", { class: "btn--sm", onClick: () => trocarPapel(m, e.id, () => refreshMembros()) }, "Trocar papel"),
            " ",
            el("button", { class: "btn--sm btn--danger", onClick: async () => {
              if (!confirm(`Desvincular ${m.username}?`)) return;
              try {
                await api(`/api/empresas/${e.id}/membros/${m.user_id}`, { method: "DELETE" });
                toast("Desvinculado");
                await refreshMembros();
              } catch (err) { toast(err.message, "err"); }
            }}, "🗑"),
          ),
        ))),
      ));
    }
    async function refreshMembros() {
      const r = await api(`/api/empresas/${e.id}/membros`);
      membros = r.membros || [];
      renderMembros();
    }
    renderMembros();

    // Monta modal
    showModal({
      title: `🏢 ${e.nome}`,
      wide: true,
      body: el("div", {}, tabs, ...Object.values(panes)),
      footer: [el("button", { class: "btn btn--primary", onClick: () => document.querySelector(".modal-backdrop")?.remove() }, "Fechar")],
    });

    // ativa aba "dados"
    const allBtns = tabs.querySelectorAll(".tab-btn");
    if (allBtns[0]) allBtns[0].classList.add("is-active");
  }

  async function vincular(empresaId, onUpdate) {
    // carrega lista de usuários
    let users = [];
    try { users = await api("/api/users"); } catch (e) { users = []; }
    if (!users.length) {
      toast("Nenhum usuário cadastrado. Crie em 'Usuários'.", "err");
      return;
    }
    const userSel = el("select", { class: "select" },
      el("option", { value: "" }, "— selecione —"),
      ...users.map((u) => el("option", { value: u.id }, `${u.username} (${u.nome})`)),
    );
    const papel = el("select", { class: "select" },
      el("option", { value: "visualizador" }, "Visualizador"),
      el("option", { value: "operador" }, "Operador"),
      el("option", { value: "admin" }, "Admin"),
    );
    showModal({
      title: "Vincular usuário",
      body: el("div", {},
        field("Usuário*", userSel),
        field("Papel na empresa*", papel),
      ),
      footer: [
        el("button", { class: "btn", onClick: () => document.querySelector(".modal-backdrop")?.remove() }, "Cancelar"),
        el("button", { class: "btn btn--primary", onClick: async () => {
          if (!userSel.value) { toast("Selecione um usuário", "err"); return; }
          try {
            await api(`/api/empresas/${empresaId}/membros`, { method: "POST", body: {
              user_id: Number(userSel.value), papel: papel.value,
            }});
            document.querySelector(".modal-backdrop")?.remove();
            toast("✓ Vinculado");
            if (onUpdate) onUpdate();
          } catch (e) { toast(e.message, "err"); }
        }}, "Vincular"),
      ],
    });
  }

  function trocarPapel(m, empresaId, onUpdate) {
    const papel = el("select", { class: "select" },
      el("option", { value: "visualizador" }, "Visualizador"),
      el("option", { value: "operador" }, "Operador"),
      el("option", { value: "admin" }, "Admin"),
    );
    papel.value = m.papel;
    const ativo = el("input", { type: "checkbox" });
    ativo.checked = !!m.ativo;
    showModal({
      title: `Membro: ${m.username}`,
      body: el("div", {},
        field("Papel", papel),
        el("label", { class: "checkbox", style: "margin-top:8px" }, ativo, " Ativo"),
      ),
      footer: [
        el("button", { class: "btn", onClick: () => document.querySelector(".modal-backdrop")?.remove() }, "Cancelar"),
        el("button", { class: "btn btn--primary", onClick: async () => {
          try {
            await api(`/api/empresas/${empresaId}/membros/${m.user_id}`, { method: "PUT", body: {
              papel: papel.value, ativo: ativo.checked,
            }});
            document.querySelector(".modal-backdrop")?.remove();
            toast("Atualizado");
            if (onUpdate) onUpdate();
          } catch (e) { toast(e.message, "err"); }
        }}, "Salvar"),
      ],
    });
  }
}

function field(label, input) {
  return el("div", { class: "field", style: "margin-top:8px" }, el("label", {}, label), input);
}

function kv(k, v) {
  return el("div", { class: "kv__row" },
    el("span", { class: "kv__label" }, k),
    el("span", { class: "kv__value" }, v),
  );
}
