// =============================================================================
//  middleware/auth.js
//  -----------------------------------------------------------------------------
//  - Lê o cookie de sessão
//  - Anexa req.user e req.empresa (multi-tenancy)
//  - Para rotas protegidas, retorna 401 se não autenticado
//  - Lista branca de rotas públicas: /api/auth/login, /api/health, raiz e assets
// =============================================================================
import { COOKIE_NAME, findSession } from "../services/auth.service.js";
import { carregarEmpresaAtiva, getPapel } from "../services/empresas.service.js";
import { db } from "../db/index.js";

const PUBLIC_API_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/mtls-login",
  "/api/auth/register-start",
  "/api/auth/register-verify",
  "/api/auth/resend-code",
  "/api/mail/config",
  "/api/news",
  "/api/health",
]);

// Prefixos públicos: comparados contra req.baseUrl + req.path (que é o caminho
// completo após o Express remover o mount point de app.use).
const PUBLIC_API_PREFIXES = [
  "/api/avatars",
];

// Rotas que NÃO exigem empresa ativa (são multi-tenant por natureza)
const NO_TENANT_REQUIRED = new Set([
  "/api/empresas",                  // listagem / seletor
  "/api/auth/me",                   // info do user
  "/api/auth/logout",
  "/api/auth/change-password",
  "/api/auth/me/avatar",
  "/api/users",                     // super-admin
  "/api/feedback",
  "/api/relatorio/templates",
  "/api/relatorio/historico",
  "/api/news",
  "/api/health",
]);

function isPublicAsset(path) {
  if (path === "/" || path === "/index.html") return true;
  if (path.startsWith("/assets/")) return true;
  if (path.startsWith("/pages/")) return true;
  if (path.startsWith("/avatars/")) return true;
  if (path.startsWith("/favicon")) return true;
  if (path.startsWith("/api/auth/login") || path.startsWith("/api/auth/logout")) return true;
  return false;
}

export function readSession(req, _res, next) {
  const token = (req.cookies && req.cookies[COOKIE_NAME]) || parseCookieHeader(req.headers.cookie, COOKIE_NAME);
  let found = findSession(token);
  // Login alternativo por certificado de cliente, aceito somente quando o
  // socket TLS foi validado contra a CA configurada no servidor.
  if (!found && req.socket?.authorized && typeof req.socket.getPeerCertificate === "function") {
    const cert = req.socket.getPeerCertificate();
    const fingerprint = cert?.fingerprint256;
    if (fingerprint) {
      const row = db.prepare(`
        SELECT u.* FROM client_certificates c
        JOIN users u ON u.id = c.user_id
        WHERE c.fingerprint256 = ? AND c.ativo = 1 AND u.ativo = 1
      `).get(String(fingerprint).toUpperCase());
      if (row) {
        const memberships = db.prepare(`
          SELECT eu.empresa_id, eu.papel, eu.permissoes, e.cnpj, e.nome, e.nome_fantasia, e.ambiente
          FROM empresa_users eu JOIN empresas e ON e.id = eu.empresa_id
          WHERE eu.user_id = ? AND eu.ativo = 1 AND e.ativo = 1
        `).all(row.id);
        found = {
          token: null,
          expiresAt: null,
          user: {
            id: row.id, username: row.username, nome: row.nome, email: row.email,
            role: row.role, primeiro_login: !!row.primeiro_login,
            isSuperAdmin: row.role === "admin", memberships,
            empresaAtivaId: row.last_empresa_id || memberships[0]?.empresa_id || null,
            authMethod: "mtls",
          },
        };
      }
    }
  }
  if (found) {
    req.user = found.user;
    req.sessionToken = found.token;
    req.sessionExpiresAt = found.expiresAt;
    // Carrega empresa ativa (multi-tenancy)
    req.empresa = carregarEmpresaAtiva(found.user, found.user.empresaAtivaId);
    // tenantFilter:
    //  - super-admin SEM empresa ativa: null (vê tudo) — exceto /api/docs onde filtramos
    //  - super-admin COM empresa ativa: filtra por ela
    //  - usuário comum: filtra pela ativa, e se não tem ativa → null
    req.isSuperAdmin = found.user.isSuperAdmin;
    if (req.empresa) {
      req.tenantFilter = { where: "empresa_id = ?", param: req.empresa.id };
      req.tenantId = req.empresa.id;
    } else {
      req.tenantFilter = null;
      req.tenantId = null;
    }
  } else {
    req.user = null;
    req.sessionToken = null;
    req.empresa = null;
    req.tenantFilter = null;
    req.tenantId = null;
  }
  next();
}

function parseCookieHeader(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = String(cookieHeader).split(";").map((p) => p.trim());
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    if (k === name) return p.slice(idx + 1).trim();
  }
  return null;
}

// Aplica autenticação em todas as rotas /api/* exceto as públicas.
// Em Express, req.path é o caminho RELATIVO ao mount point do app.use().
// Ex.: app.use("/api", requireAuth) → req.path vem sem o "/api".
// Por isso checamos tanto o req.originalUrl (URL completa) quanto o req.baseUrl + req.path
// para que as entradas de PUBLIC_API_PATHS funcionem com qualquer montagem.
export function requireAuth(req, res, next) {
  if (req.user) {
    // Para rotas que precisam de tenant ativo: se user comum sem empresa ativa, bloqueia
    const fullPath = (req.baseUrl || "") + req.path;
    const original = (req.originalUrl || "").split("?")[0];
    const requiresTenant = !NO_TENANT_REQUIRED.has(fullPath) && !NO_TENANT_REQUIRED.has(original);
    if (requiresTenant && !req.empresa && !req.isSuperAdmin) {
      return res.status(409).json({ error: "Selecione uma empresa para continuar", code: "no_tenant" });
    }
    return next();
  }
  const fullPath = (req.baseUrl || "") + req.path;
  const original = (req.originalUrl || "").split("?")[0];
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  if (PUBLIC_API_PATHS.has(fullPath)) return next();
  if (PUBLIC_API_PATHS.has(original)) return next();
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (fullPath === prefix || fullPath.startsWith(prefix + "/")) return next();
    if (original === prefix || original.startsWith(prefix + "/")) return next();
  }
  return res.status(401).json({ error: "Não autenticado" });
}
