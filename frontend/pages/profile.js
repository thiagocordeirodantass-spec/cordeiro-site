// =============================================================================
//  pages/profile.js — Perfil completo (avatar + dados + senha + atividade)
// =============================================================================
import { api, avatarEl, el, toast, navigate, devBanner } from "../assets/app.js";
import { CORDEIRO_SVG, ICONS } from "../assets/cordeiro.js";

export async function render(root) {
  const me = await api("/api/auth/me");
  const u = me.user;

  // ---- Topbar ----
  root.appendChild(el("div", { class: "topbar" },
    el("div", { class: "crumbs" },
      el("span", {}, "Início"),
      el("span", { class: "sep" }, "›"),
      el("strong", {}, "Meu perfil"),
    ),
  ));

  // ====== HERO COM AVATAR GRANDE + INFO ======
  const fotoInput = el("input", { type: "file", accept: "image/*", style: "display:none", id: "profile-foto" });
  const avatarBig = el("div", { class: "profile-avatar", id: "profile-avatar" });
  function refreshAvatar() {
    avatarBig.innerHTML = "";
    if (u.avatar_url) {
      const img = el("img", { src: u.avatar_url + "?t=" + Date.now(), alt: u.nome });
      avatarBig.appendChild(img);
    } else {
      const initials = (u.nome || u.username || "??").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
      avatarBig.textContent = initials;
    }
  }
  refreshAvatar();
  fotoInput.onchange = async () => {
    if (!fotoInput.files?.[0]) return;
    const fd = new FormData();
    fd.append("avatar", fotoInput.files[0]);
    try {
      const r = await fetch("/api/auth/me/avatar", { method: "POST", body: fd, credentials: "same-origin" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro");
      u.avatar_url = j.user.avatar_url;
      u.avatar_path = j.user.avatar_path;
      refreshAvatar();
      btnRemoverFoto.style.display = "";
      toast("✓ Foto atualizada");
    } catch (e) { toast(e.message, "err"); }
  };

  const btnRemoverFoto = el("button", { class: "toolbar__btn toolbar__btn--ghost", onClick: async () => {
    try {
      await api("/api/auth/me/avatar", { method: "DELETE" });
      u.avatar_url = null; u.avatar_path = null;
      refreshAvatar();
      btnRemoverFoto.style.display = "none";
      toast("✓ Foto removida");
    } catch (e) { toast(e.message, "err"); }
  } },
    el("span", {}, "🗑️"),
    el("span", {}, "Remover foto"),
  );
  if (!u.avatar_url) btnRemoverFoto.style.display = "none";

  const isSuper = u.is_super_admin;
  const isAdmin = u.role === "admin";
  const roleLabel = isSuper ? "Super Administrador" : isAdmin ? "Administrador" : u.role === "operador" ? "Operador" : "Consulta";
  const roleColor = isSuper ? "var(--accent)" : isAdmin ? "var(--brand)" : u.role === "operador" ? "#7c3aed" : "var(--muted)";

  const hero = el("div", { class: "card card--mod fade-in", "data-mod": "documents", style: "margin-bottom:16px" },
    el("div", { class: "card__body" },
      el("div", { class: "profile-hero" },
        el("div", { class: "profile-hero__avatar-wrap" },
          avatarBig,
          el("button", { class: "profile-hero__camera", title: "Trocar foto", onClick: () => fotoInput.click() }, "📷"),
        ),
        el("div", { class: "profile-hero__info" },
          el("div", { class: "profile-hero__name" }, u.nome || "Sem nome"),
          el("div", { class: "profile-hero__username" }, "@" + (u.username || "?")),
          el("div", { style: "display:flex; gap:6px; flex-wrap:wrap; margin-top:6px" },
            el("span", { class: "profile-role-badge", style: `background:${roleColor}20; color:${roleColor}; border-color:${roleColor}` },
              isSuper ? "🌟" : isAdmin ? "🛡️" : u.role === "operador" ? "⚙️" : "👁️",
              " ",
              roleLabel,
            ),
            u.empresa_nome ? el("span", { class: "profile-role-badge profile-role-badge--neutral" },
              "🏢", " ", u.empresa_nome,
            ) : null,
            u.last_login ? el("span", { class: "profile-role-badge profile-role-badge--neutral" },
              "🕐", " Último acesso: ", u.last_login,
            ) : null,
          ),
        ),
        el("div", { class: "profile-hero__actions" },
          el("button", { class: "toolbar__btn toolbar__btn--primary", onClick: () => fotoInput.click() },
            el("span", {}, "📷"), el("span", {}, "Trocar foto"),
          ),
          btnRemoverFoto,
        ),
      ),
    ),
  );
  root.appendChild(hero);
  root.appendChild(fotoInput);

  // ====== DADOS PESSOAIS + SENHA + ESTATÍSTICAS (3 colunas) ======
  const grid = el("div", { class: "profile-grid" });

  // ---- Card 1: Dados pessoais ----
  const inpNome = el("input", { class: "input", value: u.nome || "" });
  const inpEmail = el("input", { class: "input", type: "email", value: u.email || "" });
  const inpUsername = el("input", { class: "input", value: u.username, readonly: "true" });
  const inpRole = el("input", { class: "input", value: roleLabel, readonly: "true" });
  const statSave = el("div", { class: "import-status" });
  const btnSalvar = el("button", { class: "toolbar__btn toolbar__btn--primary" },
    el("span", {}, "💾"), el("span", {}, "Salvar alterações"),
  );
  btnSalvar.onclick = async () => {
    btnSalvar.disabled = true;
    statSave.className = "import-status";
    statSave.textContent = "Salvando…";
    try {
      const r = await api("/api/auth/me", { method: "PUT", body: { nome: inpNome.value.trim(), email: inpEmail.value.trim() } });
      Object.assign(u, r.user);
      statSave.className = "import-status import-status--ok";
      statSave.textContent = "✓ Dados salvos!";
      refreshAvatar();
    } catch (e) {
      statSave.className = "import-status import-status--err";
      statSave.textContent = e.message;
    }
    btnSalvar.disabled = false;
  };

  grid.appendChild(el("div", { class: "card card--mod fade-in-1", "data-mod": "documents" },
    el("div", { class: "card__head" }, el("h2", {}, "👤 Dados pessoais")),
    el("div", { class: "card__body" },
      el("div", { class: "field" }, el("label", {}, "Nome completo"), inpNome),
      el("div", { class: "field", style: "margin-top:10px" }, el("label", {}, "Email"), inpEmail),
      el("div", { class: "field", style: "margin-top:10px" }, el("label", {}, "Usuário"), inpUsername),
      el("div", { class: "field", style: "margin-top:10px" }, el("label", {}, "Perfil de acesso"), inpRole),
      el("div", { style: "display:flex; gap:8px; margin-top:14px; align-items:center" }, btnSalvar, statSave),
    ),
  ));

  // ---- Card 2: Trocar senha ----
  const inpSenhaAtual = el("input", { class: "input", type: "password", placeholder: "Sua senha atual" });
  const inpNovaSenha = el("input", { class: "input", type: "password", placeholder: "Nova senha (mín. 4 caracteres)" });
  const inpConfSenha = el("input", { class: "input", type: "password", placeholder: "Confirme a nova senha" });
  const statSenha = el("div", { class: "import-status" });
  const btnSalvarSenha = el("button", { class: "toolbar__btn toolbar__btn--primary" },
    el("span", {}, "🔒"), el("span", {}, "Alterar senha"),
  );
  btnSalvarSenha.onclick = async () => {
    if (inpNovaSenha.value !== inpConfSenha.value) { statSenha.className = "import-status import-status--err"; statSenha.textContent = "Senhas não conferem"; return; }
    if (inpNovaSenha.value.length < 4) { statSenha.className = "import-status import-status--err"; statSenha.textContent = "Mínimo 4 caracteres"; return; }
    btnSalvarSenha.disabled = true;
    statSenha.className = "import-status"; statSenha.textContent = "Salvando…";
    try {
      await api("/api/auth/change-password", { method: "POST", body: { senhaAtual: inpSenhaAtual.value, novaSenha: inpNovaSenha.value } });
      statSenha.className = "import-status import-status--ok";
      statSenha.textContent = "✓ Senha alterada!";
      inpSenhaAtual.value = inpNovaSenha.value = inpConfSenha.value = "";
    } catch (e) {
      statSenha.className = "import-status import-status--err";
      statSenha.textContent = e.message;
    }
    btnSalvarSenha.disabled = false;
  };

  // Indicador de força da senha
  const strength = el("div", { class: "password-strength", id: "pwd-strength" });
  inpNovaSenha.oninput = () => {
    const v = inpNovaSenha.value;
    let level = 0;
    if (v.length >= 4) level = 1;
    if (v.length >= 8) level = 2;
    if (v.length >= 12 && /[A-Z]/.test(v) && /[0-9]/.test(v)) level = 3;
    if (v.length >= 14 && /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v)) level = 4;
    strength.className = "password-strength password-strength--" + ["none", "weak", "ok", "good", "strong"][level];
    strength.textContent = ["", "Fraca", "OK", "Boa", "Forte"][level];
  };

  grid.appendChild(el("div", { class: "card card--mod fade-in-1", "data-mod": "documents" },
    el("div", { class: "card__head" }, el("h2", {}, "🔒 Segurança")),
    el("div", { class: "card__body" },
      el("div", { class: "field" }, el("label", {}, "Senha atual"), inpSenhaAtual),
      el("div", { class: "field", style: "margin-top:10px" },
        el("label", {}, "Nova senha"),
        inpNovaSenha,
        strength,
      ),
      el("div", { class: "field", style: "margin-top:10px" }, el("label", {}, "Confirmar"), inpConfSenha),
      el("div", { style: "display:flex; gap:8px; margin-top:14px; align-items:center" }, btnSalvarSenha, statSenha),
    ),
  ));

  // ---- Card 3: Estatísticas + Logout ----
  let stats = { totalDocs: 0, lastActivity: "—" };
  try {
    const r = await api("/api/dashboard/kpis");
    stats.totalDocs = r.total || 0;
  } catch (e) { /* silencioso */ }

  const btnLogout = el("button", { class: "toolbar__btn toolbar__btn--danger", onClick: async () => {
    if (!confirm("Encerrar a sessão agora?")) return;
    try {
      await api("/api/logout", { method: "POST" });
      location.hash = "#/login";
      location.reload();
    } catch (e) { toast(e.message, "err"); }
  } },
    el("span", {}, "🚪"), el("span", {}, "Sair da conta"),
  );

  grid.appendChild(el("div", { class: "card card--mod fade-in-1", "data-mod": "documents" },
    el("div", { class: "card__head" }, el("h2", {}, "📊 Atividade")),
    el("div", { class: "card__body" },
      el("div", { class: "profile-stats" },
        el("div", { class: "profile-stat" },
          el("div", { class: "profile-stat__icon" }, "📄"),
          el("div", {}, el("div", { class: "profile-stat__label" }, "Documentos no sistema"),
                    el("div", { class: "profile-stat__value" }, String(stats.totalDocs))),
        ),
        el("div", { class: "profile-stat" },
          el("div", { class: "profile-stat__icon" }, "🕐"),
          el("div", {}, el("div", { class: "profile-stat__label" }, "Conta criada em"),
                    el("div", { class: "profile-stat__value", style: "font-size:14px" }, u.created_at || "—")),
        ),
        el("div", { class: "profile-stat" },
          el("div", { class: "profile-stat__icon" }, "🔐"),
          el("div", {}, el("div", { class: "profile-stat__label" }, "Último acesso"),
                    el("div", { class: "profile-stat__value", style: "font-size:14px" }, u.last_login || "—")),
        ),
      ),
      el("h3", { style: "margin:18px 0 8px; font-size:13px; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em" }, "Sessão"),
      el("div", { style: "display:flex; gap:8px" },
        btnLogout,
        el("a", { href: "#/audit", class: "toolbar__btn toolbar__btn--ghost" },
          el("span", {}, "📜"), el("span", {}, "Ver histórico"),
        ),
      ),
    ),
  ));

  root.appendChild(grid);
}
