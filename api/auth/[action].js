import crypto from "node:crypto";
import { ensureSchema, pool } from "../_database.js";
import {accessEmail,sendResend} from "../_email-templates.js";

const COOKIE = "sid";
const SESSION_HOURS = 8;
async function sendAccessCodeLegacy({to,name,code}){
  if(!process.env.RESEND_API_KEY) return {sent:false};
  const safeName=String(name||"").replace(/[<>&"']/g,"");
  const html=`<!doctype html><html><body style="margin:0;background:#061713;padding:36px 16px;font-family:Arial,sans-serif;color:#eafff8">
  <table role="presentation" width="100%"><tr><td align="center"><table width="560" style="max-width:560px;background:#0b241d;border:1px solid #1f5a49;border-radius:24px;overflow:hidden">
  <tr><td style="padding:34px;background:#0b2d24"><div style="color:#62e0b8;font-size:11px;letter-spacing:3px">HAIXEL · ACESSO SEGURO</div>
  <h1 style="margin:14px 0 8px;font-size:27px;color:#fff">Confirme sua identidade</h1>
  <p style="margin:0;color:#9fc4b8;line-height:1.6">Olá, ${safeName}. Use o código abaixo para concluir seu acesso à plataforma.</p></td></tr>
  <tr><td style="padding:34px"><div style="padding:25px;text-align:center;border:1px solid #2f8068;border-radius:16px;background:#071d18">
  <small style="color:#7ca99b;letter-spacing:2px">CÓDIGO DE VERIFICAÇÃO</small>
  <div style="font:700 38px monospace;letter-spacing:10px;color:#65e2ba;margin:13px 0">${code}</div>
  <small style="color:#d9aa52">EXPIRA EM 15 MINUTOS</small></div>
  <p style="color:#789b90;font-size:12px;line-height:1.6;margin:22px 0 0">🔐 Não compartilhe este código. A equipe Haixel nunca solicitará sua senha ou certificado por e-mail.</p></td></tr>
  <tr><td style="padding:18px 34px;border-top:1px solid #173f34;color:#587c71;font-size:10px">CONEXÃO PROTEGIDA · MONITORAMENTO ATIVO · ${new Date().getFullYear()}</td></tr>
  </table></td></tr></table></body></html>`;
  const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{
    Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({from:process.env.MAIL_FROM||"Haixel <acesso@cordeirofiscal.com.br>",
      to:[to],subject:`${code} é seu código de acesso · Haixel`,html})});
  if(!result.ok) throw new Error("Falha no serviço de e-mail");
  return {sent:true};
}

async function sendAccessCode({to,name,code}){
  const template=accessEmail({name,code});
  return sendResend({to,...template});
}

function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

function validPassword(password, salt, expectedHex) {
  try {
    const actual = hashPassword(password, salt).hash;
    return crypto.timingSafeEqual(
      Buffer.from(actual, "hex"),
      Buffer.from(expectedHex, "hex"),
    );
  } catch {
    return false;
  }
}

function cookie(request, name) {
  const raw = request.headers.cookie || "";
  const entry = raw
    .split(";")
    .map((item) => item.trim().split("="))
    .find(([key]) => key === name);
  return entry ? decodeURIComponent(entry.slice(1).join("=")) : null;
}

async function publicUser(user) {
  const membershipsResult = await pool.query(
    `SELECT e.id AS empresa_id,eu.papel,e.cnpj,e.nome,e.nome_fantasia,e.ambiente
       FROM empresa_users eu JOIN empresas e ON e.id=eu.empresa_id
      WHERE eu.user_id=$1 AND eu.ativo=TRUE AND e.ativo=TRUE ORDER BY e.nome`,
    [user.id],
  );
  const memberships = membershipsResult.rows;
  let activeId = user.empresa_ativa_id || null;
  if (!activeId && memberships.length === 1) activeId = memberships[0].empresa_id;
  const activeResult = activeId
    ? await pool.query(
        `SELECT id AS empresa_id,cnpj,nome,nome_fantasia,ambiente,regime_tributario
           FROM empresas WHERE id=$1 AND ativo=TRUE`,
        [activeId],
      )
    : { rows: [] };
  return {
    id: Number(user.id),
    username: user.username,
    nome: user.nome,
    email: user.email,
    role: user.role,
    primeiro_login: Boolean(user.primeiro_login),
    onboarding_completed: Boolean(user.onboarding_completed_at),
    ultimo_login: user.ultimo_login,
    is_super_admin: user.role === "admin",
    memberships,
    empresa_ativa_id: activeId,
    empresa_ativa: activeResult.rows[0] || null,
    certificate_verified: user.auth_method === "certificate" || user.auth_method === "mtls",
    preferencias: {},
    cargo: user.cargo || "",
    area_atuacao: user.area_atuacao || "",
    bio: user.bio || "",
    linkedin_url: user.linkedin_url || "",
    instagram_url: user.instagram_url || "",
    website_url: user.website_url || "",
    telefone: user.telefone || "",
    avatar_url: user.avatar_mime ? "/api/auth/avatar" : null,
  };
}

async function currentUser(request) {
  const token = cookie(request, COOKIE);
  if (!token) return null;
  const result = await pool.query(
    `SELECT u.*,s.auth_method,s.empresa_ativa_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > NOW() AND u.ativo = TRUE`,
    [token],
  );
  return result.rows[0] || null;
}

function setSession(response, token, hours = SESSION_HOURS) {
  const domain = process.env.MTLS_COOKIE_DOMAIN
    ? `; Domain=${process.env.MTLS_COOKIE_DOMAIN}` : "";
  response.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${hours * 3600}${domain}`,
  );
}

async function createSession(request, response, userId, remember = false) {
  const token = crypto.randomBytes(32).toString("hex");
  const hours=remember?24*30:SESSION_HOURS;
  const expiresAt = new Date(Date.now() + hours * 3600_000);
  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      token,
      userId,
      expiresAt,
      request.headers["x-forwarded-for"] || null,
      request.headers["user-agent"] || null,
    ],
  );
  setSession(response, token, hours);
  return expiresAt.toISOString();
}

export default async function handler(request, response) {
  try {
    await ensureSchema();
    const action = request.query.action;

    if (action === "mtls-login" && request.method === "GET") {
      const configuredSecret=String(process.env.MTLS_EDGE_SECRET||"");
      const receivedSecret=String(request.headers["x-mtls-edge-secret"]||"");
      if(!configuredSecret) return response.status(503).json({
        error:"mTLS ainda não configurado no domínio Cloudflare",
      });
      const secretOk=receivedSecret.length===configuredSecret.length &&
        crypto.timingSafeEqual(Buffer.from(receivedSecret),Buffer.from(configuredSecret));
      const verified=String(request.headers["cf-cert-verified"]||"").toUpperCase()==="SUCCESS";
      const subject=String(request.headers["cf-cert-subject-dn"]||"");
      const serial=String(request.headers["cf-cert-serial"]||"");
      if(!secretOk||!verified) return response.status(401).json({
        error:"O navegador não apresentou um certificado cliente válido",
      });
      const token=cookie(request,COOKIE);
      if(!token)return response.status(401).json({error:"Entre com usuário e senha antes de validar o certificado da empresa"});
      const companyId=Number(request.query.empresaId);
      const company=await pool.query("SELECT id,cnpj FROM empresas WHERE id=$1 AND ativo=TRUE",[companyId]);
      if(!company.rowCount)return response.status(404).json({error:"Empresa não encontrada ou desativada"});
      const companyCnpj=String(company.rows[0].cnpj||"").replace(/\D/g,"");
      if(!companyCnpj||!subject.replace(/\D/g,"").includes(companyCnpj))
        return response.status(403).json({error:"O certificado apresentado não corresponde ao CNPJ da empresa selecionada"});
      const session=await pool.query("SELECT user_id FROM sessions WHERE id=$1 AND expires_at>NOW()",[token]);
      if(!session.rowCount)return response.status(401).json({error:"Sessão expirada"});
      const access=await pool.query(`SELECT u.role,eu.user_id membership FROM users u
        LEFT JOIN empresa_users eu ON eu.user_id=u.id AND eu.empresa_id=$2 AND eu.ativo=TRUE
        WHERE u.id=$1 AND u.ativo=TRUE`,[session.rows[0].user_id,companyId]);
      if(!access.rowCount||(access.rows[0].role!=="admin"&&!access.rows[0].membership))
        return response.status(403).json({error:"Usuário sem acesso à empresa deste certificado"});
      await pool.query(`UPDATE sessions SET empresa_ativa_id=$1,auth_method='certificate',
        user_agent=COALESCE(user_agent,'') || $3 WHERE id=$2`,
        [companyId,token,` mTLS:${serial}`]);
      const target=String(request.query.redirect||"/");
      return response.redirect(302,target.startsWith("/")&&!target.startsWith("//")?target:"/");
    }

    if (action === "login" && request.method === "POST") {
      const username = String(request.body?.username || "").trim();
      const password = String(request.body?.password || "");
      const result = await pool.query(
        "SELECT * FROM users WHERE username = $1 AND ativo = TRUE",
        [username],
      );
      const user = result.rows[0];
      if (!user || !validPassword(password, user.password_salt, user.password_hash)) {
        return response.status(401).json({ error: "Usuário ou senha inválidos" });
      }
      const expiresAt = await createSession(request, response, user.id,Boolean(request.body?.remember));
      await pool.query("UPDATE users SET ultimo_login = NOW() WHERE id = $1", [
        user.id,
      ]);
      return response.json({ ok: true, user: await publicUser(user), expiresAt });
    }

    if (action === "me" && request.method === "GET") {
      const user = await currentUser(request);
      if (!user)
        return response.status(401).json({ error: "Não autenticado" });
      return response.json({ user: await publicUser(user) });
    }

    if (action === "onboarding" && request.method === "POST") {
      const user = await currentUser(request);
      if (!user)
        return response.status(401).json({ error: "Não autenticado" });
      await pool.query(
        "UPDATE users SET onboarding_completed_at=COALESCE(onboarding_completed_at,NOW()) WHERE id=$1",
        [user.id],
      );
      return response.json({ ok: true });
    }

    if (action === "me" && request.method === "PUT") {
      const user = await currentUser(request);
      if (!user)
        return response.status(401).json({ error: "Não autenticado" });
      const data = request.body || {};
      const result = await pool.query(
        `UPDATE users SET nome=COALESCE($2,nome),email=COALESCE($3,email),
          cargo=$4,area_atuacao=$5,bio=$6,linkedin_url=$7,instagram_url=$8,
          website_url=$9,telefone=$10,preferencias=$11::jsonb
         WHERE id=$1 RETURNING *`,
        [user.id,data.nome || null,data.email || null,data.cargo || null,
         data.area_atuacao || null,data.bio || null,data.linkedin_url || null,
         data.instagram_url || null,data.website_url || null,data.telefone || null,
         JSON.stringify(data.preferencias || {})],
      );
      return response.json({ ok: true, user: await publicUser(result.rows[0]) });
    }

    if (action === "logout" && request.method === "POST") {
      const token = cookie(request, COOKIE);
      if (token) await pool.query("DELETE FROM sessions WHERE id = $1", [token]);
      response.setHeader(
        "Set-Cookie",
        `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      );
      return response.json({ ok: true });
    }

    if (action === "register-start" && request.method === "POST") {
      const { nome, email, username, password } = request.body || {};
      if (!nome || !email || !username || !password)
        return response.status(400).json({ error: "Preencha todos os campos" });
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username))
        return response.status(400).json({ error: "Usuário inválido" });
      if (String(password).length < 4)
        return response.status(400).json({ error: "Senha muito curta" });
      const exists = await pool.query(
        "SELECT 1 FROM users WHERE username = $1 OR email = $2",
        [username, email],
      );
      if (exists.rowCount)
        return response.status(400).json({ error: "Usuário ou e-mail já cadastrado" });
      const { salt, hash } = hashPassword(String(password));
      const codigo = String(crypto.randomInt(100000, 1000000));
      await pool.query("DELETE FROM email_verifications WHERE email = $1", [
        email,
      ]);
      await pool.query(
        `INSERT INTO email_verifications
          (email, username, nome, password_hash, password_salt, codigo, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '15 minutes')`,
        [email, username, nome, hash, salt, codigo],
      );
      const mail=await sendAccessCode({to:email,name:nome,code:codigo});
      return response.json({
        ok: true,
        codigoDev: mail.sent ? null : codigo,
        mailMethod: mail.sent ? "email" : "console",
      });
    }

    if (action === "register-verify" && request.method === "POST") {
      const email = String(request.body?.email || "");
      const codigo = String(request.body?.codigo || "");
      const pending = await pool.query(
        `SELECT * FROM email_verifications
          WHERE email = $1 ORDER BY id DESC LIMIT 1`,
        [email],
      );
      const row = pending.rows[0];
      if (!row || row.codigo !== codigo || new Date(row.expires_at) < new Date())
        return response.status(400).json({ error: "Código inválido ou expirado" });
      const count = await pool.query("SELECT COUNT(*)::int AS total FROM users");
      const role = count.rows[0].total === 0 ? "admin" : "operador";
      const inserted = await pool.query(
        `INSERT INTO users
          (username, nome, email, password_hash, password_salt, role)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          row.username,
          row.nome,
          row.email,
          row.password_hash,
          row.password_salt,
          role,
        ],
      );
      await pool.query("DELETE FROM email_verifications WHERE id = $1", [row.id]);
      const user = inserted.rows[0];
      const expiresAt = await createSession(request, response, user.id);
      return response.json({
        ok: true,
        user: await publicUser(user),
        expiresAt,
        role,
      });
    }

    return response.status(404).json({ error: "Endpoint não encontrado" });
  } catch (error) {
    console.error("auth error", error);
    return response.status(500).json({ error: "Erro interno de autenticação" });
  }
}
