// =============================================================================
//  routes/empresas.routes.js — multi-tenancy
//  -----------------------------------------------------------------------------
//  GET    /api/empresas                      — lista empresas do user (ou todas se super-admin)
//  GET    /api/empresas/:id                  — detalhe
//  POST   /api/empresas                      — criar (super-admin)
//  PUT    /api/empresas/:id                  — atualizar (admin da empresa)
//  GET    /api/empresas/:id/membros          — listar membros
//  POST   /api/empresas/:id/membros          — vincular usuário
//  PUT    /api/empresas/:id/membros/:userId  — alterar papel / ativar
//  DELETE /api/empresas/:id/membros/:userId  — desvincular
//  POST   /api/empresas/:id/ativar           — mudar empresa ativa
// =============================================================================
import { Router } from "express";
import { db } from "../db/index.js";
import * as svc from "../services/empresas.service.js";

const router = Router();

// ---- Listar (para o seletor) ----
router.get("/", (req, res) => {
  try {
    res.json({ empresas: svc.listarParaUsuario(req.user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Detalhe ----
router.get("/:id", (req, res) => {
  const e = svc.getEmpresaById(req.params.id);
  if (!e) return res.status(404).json({ error: "Empresa não encontrada" });
  if (!req.isSuperAdmin && !req.user.memberships.find((m) => m.empresa_id === e.id)) {
    return res.status(403).json({ error: "Sem acesso a essa empresa" });
  }
  res.json(e);
});

// ---- Criar (apenas super-admin) ----
router.post("/", (req, res) => {
  try { res.json(svc.criarEmpresa(req.user, req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Atualizar ----
router.put("/:id", (req, res) => {
  try { res.json(svc.atualizarEmpresa(req.user, req.params.id, req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Membros ----
router.get("/:id/membros", (req, res) => {
  try { res.json({ membros: svc.listarMembros(req.user, req.params.id) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/:id/membros", (req, res) => {
  try { res.json(svc.vincularUsuario(req.user, req.params.id, req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.put("/:id/membros/:userId", (req, res) => {
  try { res.json(svc.atualizarMembro(req.user, req.params.id, req.params.userId, req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/:id/membros/:userId", (req, res) => {
  try { res.json(svc.desvincularUsuario(req.user, req.params.id, req.params.userId)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Mudar empresa ativa ----
router.post("/:id/ativar", (req, res) => {
  try {
    const empresa = svc.getEmpresaById(req.params.id);
    if (!empresa || !empresa.ativo)
      return res.status(404).json({ error: "Empresa não encontrada ou desativada" });
    if (empresa.requer_certificado && req.user.authMethod !== "certificate" && req.user.authMethod !== "mtls")
      return res.status(403).json({ error: "A INTECOM somente pode ser acessada com certificado digital A1" });
    const r = svc.ativarEmpresa(req.user, req.params.id);
    if (req.sessionToken) {
      db.prepare("UPDATE sessions SET empresa_ativa_id = ? WHERE id = ?").run(Number(req.params.id), req.sessionToken);
    }
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Limpar empresa ativa (super-admin: ver tudo) ----
router.post("/limpar-ativa", (req, res) => {
  if (!req.isSuperAdmin) return res.status(403).json({ error: "Apenas super-admin" });
  if (req.sessionToken) {
    db.prepare("UPDATE sessions SET empresa_ativa_id = NULL WHERE id = ?").run(req.sessionToken);
  }
  res.json({ ok: true });
});

export default router;
