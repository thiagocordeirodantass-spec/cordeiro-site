import crypto from "node:crypto";
import fs from "node:fs/promises";
import formidable from "formidable";
import forge from "node-forge";
import { ensureSchema, pool } from "../_database.js";

export const config = { api: { bodyParser: false } };

function certificateFingerprint(buffer, password) {
  const p12 = forge.pkcs12.pkcs12FromAsn1(
    forge.asn1.fromDer(buffer.toString("binary")),
    false,
    password,
  );
  for (const content of p12.safeContents)
    for (const bag of content.safeBags)
      if (bag.cert) {
        const der = forge.asn1.toDer(
          forge.pki.certificateToAsn1(bag.cert),
        ).getBytes();
        return crypto.createHash("sha256").update(Buffer.from(der, "binary")).digest("hex");
      }
  throw new Error("Certificado ausente no arquivo");
}

export default async function handler(request, response) {
  if (request.method !== "POST")
    return response.status(405).json({ error: "Método não permitido" });
  try {
    await ensureSchema();
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(request);
    const password = String(fields.password?.[0] || fields.senha?.[0] || "");
    const file = Object.values(files).flat().find(Boolean);
    if (!file || !password)
      return response.status(400).json({ error: "Selecione o certificado e informe a senha" });

    const uploaded = await fs.readFile(file.filepath);
    const configured = Buffer.from(process.env.SEFAZ_PFX_BASE64 || "", "base64");
    const uploadedFingerprint = certificateFingerprint(uploaded, password);
    const configuredFingerprint = certificateFingerprint(
      configured,
      process.env.SEFAZ_PFX_PASSWORD,
    );
    if (uploadedFingerprint !== configuredFingerprint)
      return response.status(403).json({ error: "Certificado não autorizado para a INTECOM" });

    const company = await pool.query(
      "SELECT * FROM empresas WHERE cnpj='03857930000154' AND ativo=TRUE",
    );
    if (!company.rowCount)
      return response.status(403).json({ error: "Empresa INTECOM desativada" });
    const user = await pool.query(
      `SELECT u.* FROM users u
       LEFT JOIN empresa_users eu ON eu.user_id=u.id AND eu.empresa_id=$1
       WHERE u.ativo=TRUE AND u.role='admin'
       ORDER BY (eu.user_id IS NOT NULL) DESC,u.id LIMIT 1`,
      [company.rows[0].id],
    );
    if (!user.rowCount)
      return response.status(403).json({ error: "Administrador não configurado" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 8 * 3600_000);
    await pool.query(
      `INSERT INTO sessions(id,user_id,expires_at,ip,user_agent,empresa_ativa_id,auth_method)
       VALUES($1,$2,$3,$4,$5,$6,'certificate')`,
      [token,user.rows[0].id,expiresAt,request.headers["x-forwarded-for"]||null,
       request.headers["user-agent"]||null,company.rows[0].id],
    );
    response.setHeader(
      "Set-Cookie",
      `sid=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`,
    );
    return response.json({ ok: true, empresa: company.rows[0] });
  } catch (error) {
    console.error("certificate login error", error);
    return response.status(401).json({ error: "Certificado ou senha inválidos" });
  }
}
