// =============================================================================
//  services/empresas.service.js
//  -----------------------------------------------------------------------------
//  Lógica de multi-tenancy: cadastro de empresas, vínculo usuário×empresa,
//  troca de empresa ativa, helper de "todas as empresas" para super-admin.
//
//  Regras de permissão:
//    - super-admin (users.role='admin') → pode tudo, em qualquer empresa, sem precisar vínculo
//    - caso contrário, precisa de empresa_users.papel ∈ {admin,operador,visualizador}
//
//  Sobre "papel efetivo":
//    - Super-admin: 'admin' em qualquer empresa (mesmo sem vínculo)
//    - Membro: papel da empresa_users (admin/operador/visualizador)
// =============================================================================
import { db } from "../db/index.js";

function onlyDigits(s) { return String(s || "").replace(/\D/g, ""); }

function sanitize(row) {
  if (!row) return null;
  const r = { ...row };
  return r;
}

// Carrega todas as empresas que o user tem membership ativo
export function listarEmpresasDoUser(userId) {
  return db.prepare(`
    SELECT e.*, eu.papel
    FROM empresas e
    JOIN empresa_users eu ON eu.empresa_id = e.id
    WHERE eu.user_id = ? AND eu.ativo = 1 AND e.ativo = 1
    ORDER BY e.nome
  `).all(userId).map(sanitize);
}

// Lista empresas para o seletor (front): todas se super-admin, senão só as vinculadas
export function listarParaUsuario(user) {
  if (!user) return [];
  if (user.role === "admin") {
    // super-admin vê todas
    return db.prepare(`SELECT id, cnpj, nome, nome_fantasia, ambiente, regime_tributario, ativo FROM empresas ORDER BY nome`).all();
  }
  return db.prepare(`
    SELECT e.id, e.cnpj, e.nome, e.nome_fantasia, e.ambiente, e.regime_tributario, e.ativo
    FROM empresas e
    JOIN empresa_users eu ON eu.empresa_id = e.id
    WHERE eu.user_id = ? AND eu.ativo = 1 AND e.ativo = 1
    ORDER BY e.nome
  `).all(user.id);
}

export function getEmpresaById(id) {
  if (!id) return null;
  return sanitize(db.prepare("SELECT * FROM empresas WHERE id = ?").get(Number(id)));
}

// Papel efetivo de um user numa empresa (considera super-admin)
export function getPapel(user, empresaId) {
  if (!user || !empresaId) return null;
  if (user.role === "admin") return "admin"; // super-admin
  const row = db.prepare(`
    SELECT papel FROM empresa_users
    WHERE user_id = ? AND empresa_id = ? AND ativo = 1
  `).get(user.id, Number(empresaId));
  return row?.papel || null;
}

// Verifica se o user tem acesso à empresa (super-admin ou membership ativo)
export function userTemAcesso(user, empresaId) {
  return getPapel(user, empresaId) !== null;
}

// Carrega a empresa ativa + papel efetivo (usado pelo middleware)
export function carregarEmpresaAtiva(user, empresaId) {
  if (!user) return null;
  // Sem empresa selecionada: super-admin escolhe depois; demais precisam ter membership
  if (!empresaId) {
    // super-admin pode ficar sem empresa ativa, mas as queries vão puxar tudo
    // (req.tenantFilter=null) até que ele escolha
    return null;
  }
  const e = getEmpresaById(empresaId);
  if (!e) return null;
  const papel = getPapel(user, e.id);
  if (!papel) return null; // sem acesso
  return { ...e, papel, isSuperAdmin: user.role === "admin" };
}

// ---- Mutações ----
function validarCnpj(cnpj) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return "CNPJ deve ter 14 dígitos";
  // Validação dos dígitos verificadores
  if (/^(\d)\1+$/.test(d)) return "CNPJ inválido";
  const calc = (slice) => {
    let pos = slice.length - 7;
    let soma = 0;
    for (let i = slice.length; i >= 1; i--) {
      soma += Number(slice[slice.length - i]) * pos;
      pos = pos === 2 ? 9 : pos - 1;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (calc(d.slice(0, 12)) !== Number(d[12])) return "CNPJ inválido";
  if (calc(d.slice(0, 13)) !== Number(d[13])) return "CNPJ inválido";
  return null;
}

export function criarEmpresa(adminUser, body) {
  if (!adminUser || adminUser.role !== "admin") {
    throw new Error("Apenas super-admin pode criar empresa");
  }
  const cnpjDigits = onlyDigits(body.cnpj);
  const cnpjErr = validarCnpj(cnpjDigits);
  if (cnpjErr) throw new Error(cnpjErr);
  if (!body.nome || !String(body.nome).trim()) throw new Error("Nome é obrigatório");
  if (db.prepare("SELECT id FROM empresas WHERE cnpj = ?").get(cnpjDigits)) {
    throw new Error("Já existe empresa com esse CNPJ");
  }
  const regime = body.regime_tributario || null;
  if (regime && !["simples", "presumido", "real", "mei"].includes(regime)) {
    throw new Error("Regime tributário inválido");
  }
  const ambiente = body.ambiente === "producao" ? "producao" : "homologacao";
  const info = db.prepare(`
    INSERT INTO empresas (cnpj, nome, nome_fantasia, ie, regime_tributario, ambiente, ativo)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(
    cnpjDigits,
    String(body.nome).trim(),
    body.nome_fantasia ? String(body.nome_fantasia).trim() : null,
    body.ie ? String(body.ie).trim() : null,
    regime,
    ambiente,
  );
  return getEmpresaById(Number(info.lastInsertRowid));
}

export function atualizarEmpresa(user, id, body) {
  const eid = Number(id);
  const papel = getPapel(user, eid);
  if (papel !== "admin") throw new Error("Apenas admin da empresa pode atualizar");
  const fields = [];
  const values = [];
  if (body.nome != null) { fields.push("nome = ?"); values.push(String(body.nome).trim()); }
  if (body.nome_fantasia != null) { fields.push("nome_fantasia = ?"); values.push(String(body.nome_fantasia).trim() || null); }
  if (body.ie != null) { fields.push("ie = ?"); values.push(String(body.ie).trim() || null); }
  if (body.regime_tributario != null) {
    const r = body.regime_tributario;
    if (r && !["simples", "presumido", "real", "mei"].includes(r)) {
      throw new Error("Regime tributário inválido");
    }
    fields.push("regime_tributario = ?"); values.push(r || null);
  }
  if (body.ambiente != null) { fields.push("ambiente = ?"); values.push(body.ambiente === "producao" ? "producao" : "homologacao"); }
  if (body.ativo != null) { fields.push("ativo = ?"); values.push(body.ativo ? 1 : 0); }
  if (!fields.length) return getEmpresaById(eid);
  fields.push("updated_at = datetime('now')");
  values.push(eid);
  db.prepare(`UPDATE empresas SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getEmpresaById(eid);
}

export function listarMembros(user, empresaId) {
  const papel = getPapel(user, empresaId);
  if (!papel) throw new Error("Sem acesso a essa empresa");
  return db.prepare(`
    SELECT eu.id, eu.empresa_id, eu.user_id, eu.papel, eu.ativo, eu.created_at,
           u.username, u.nome, u.email, u.ultimo_login, u.avatar_path
    FROM empresa_users eu
    JOIN users u ON u.id = eu.user_id
    WHERE eu.empresa_id = ?
    ORDER BY u.nome
  `).all(Number(empresaId));
}

export function vincularUsuario(user, empresaId, body) {
  if (getPapel(user, empresaId) !== "admin") throw new Error("Apenas admin da empresa pode vincular");
  const userId = Number(body.user_id);
  const papel = body.papel;
  if (!userId) throw new Error("user_id obrigatório");
  if (!["admin", "operador", "visualizador"].includes(papel)) throw new Error("Papel inválido");
  const u = db.prepare("SELECT id, role FROM users WHERE id = ?").get(userId);
  if (!u) throw new Error("Usuário não existe");
  // Ambiente exclusivo: ao vincular, remove associações anteriores e fixa
  // esta empresa como o único tenant ativo do usuário.
  if (u.role !== "admin") {
    db.prepare("DELETE FROM empresa_users WHERE user_id = ? AND empresa_id <> ?")
      .run(userId, Number(empresaId));
  }
  db.prepare("UPDATE users SET last_empresa_id = ? WHERE id = ?")
    .run(Number(empresaId), userId);
  // upsert
  const existing = db.prepare("SELECT id FROM empresa_users WHERE empresa_id = ? AND user_id = ?").get(empresaId, userId);
  if (existing) {
    db.prepare("UPDATE empresa_users SET papel = ?, ativo = 1 WHERE id = ?").run(papel, existing.id);
    return { id: existing.id, ok: true, updated: true };
  }
  const info = db.prepare(`
    INSERT INTO empresa_users (empresa_id, user_id, papel, ativo)
    VALUES (?, ?, ?, 1)
  `).run(empresaId, userId, papel);
  return { id: Number(info.lastInsertRowid), ok: true, created: true };
}

export function atualizarMembro(user, empresaId, userId, body) {
  if (getPapel(user, empresaId) !== "admin") throw new Error("Apenas admin da empresa pode alterar");
  if (body.papel && !["admin", "operador", "visualizador"].includes(body.papel)) {
    throw new Error("Papel inválido");
  }
  const fields = [];
  const values = [];
  if (body.papel != null) { fields.push("papel = ?"); values.push(body.papel); }
  if (body.ativo != null) { fields.push("ativo = ?"); values.push(body.ativo ? 1 : 0); }
  if (!fields.length) return { ok: true };
  values.push(Number(empresaId), Number(userId));
  db.prepare(`UPDATE empresa_users SET ${fields.join(", ")} WHERE empresa_id = ? AND user_id = ?`).run(...values);
  return { ok: true };
}

export function desvincularUsuario(user, empresaId, userId) {
  if (getPapel(user, empresaId) !== "admin") throw new Error("Apenas admin da empresa pode desvincular");
  // Não permite remover o último admin
  const papel = db.prepare("SELECT papel FROM empresa_users WHERE empresa_id = ? AND user_id = ?").get(empresaId, userId)?.papel;
  if (papel === "admin") {
    const outros = db.prepare(`SELECT COUNT(*) as c FROM empresa_users
      WHERE empresa_id = ? AND papel = 'admin' AND ativo = 1 AND user_id != ?`).get(empresaId, userId).c;
    if (outros === 0) {
      throw new Error("Não é possível remover o último admin da empresa");
    }
  }
  db.prepare("DELETE FROM empresa_users WHERE empresa_id = ? AND user_id = ?").run(Number(empresaId), Number(userId));
  return { ok: true };
}

export function ativarEmpresa(user, empresaId) {
  if (!userTemAcesso(user, empresaId)) throw new Error("Sem acesso a essa empresa");
  db.prepare("UPDATE users SET last_empresa_id = ? WHERE id = ?").run(Number(empresaId), user.id);
  return { ok: true, empresaId: Number(empresaId) };
}

// ---- Bootstrap: cria empresa padrão se não existir nenhuma, vincula admin ----
export function bootstrapEmpresas(adminUserId) {
  const total = db.prepare("SELECT COUNT(*) as c FROM empresas").get().c;
  if (total > 0) return null;
  // Cria empresa padrão
  const info = db.prepare(`
    INSERT INTO empresas (cnpj, nome, nome_fantasia, ambiente, ativo)
    VALUES (?, 'Minha Empresa', null, 'homologacao', 1)
  `).run("00000000000000");
  const empId = Number(info.lastInsertRowid);
  // Vincula o admin como admin da empresa
  db.prepare(`
    INSERT INTO empresa_users (empresa_id, user_id, papel, ativo)
    VALUES (?, ?, 'admin', 1)
  `).run(empId, adminUserId);
  return getEmpresaById(empId);
}
