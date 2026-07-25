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

const moduleDefaults = {
  cnd:{prazo_alerta:10,alerta_modo:"dias",alerta_dia_semana:1,alerta_dia_mes:1,
    alerta_vencimento:true,alerta_vencidas:true,alerta_positivas:true,remetente:"",dominio_remetente:""},
  sefaz:{consulta_automatica:true,importar_automaticamente:true,uf:"MG",ult_nsu:"0",somente_consulta:true},
  documentos:{deduplicar:true,importar_xml:true,guardar_xml:true},
  alertas:{email_ativo:true,frequencia:"diaria",hora:"08:00"},
};
router.get("/:id/modulos",(req,res)=>{
  const empresa=svc.getEmpresaById(req.params.id);
  if(!empresa)return res.status(404).json({error:"Empresa ou filial não encontrada"});
  const modules=structuredClone(moduleDefaults);
  for(const row of db.prepare("SELECT * FROM empresa_module_config WHERE empresa_id=?").all(empresa.id)){
    try{modules[row.modulo]={...(modules[row.modulo]||{}),...JSON.parse(row.configuracao),ativo:Boolean(row.ativo)}}catch{}
  }
  const emails=db.prepare("SELECT * FROM empresa_alert_emails WHERE empresa_id=? ORDER BY email").all(empresa.id);
  res.json({empresa,modulos:modules,emails});
});
router.put("/:id/modulos",(req,res)=>{
  if(req.user?.role!=="admin")return res.status(403).json({error:"Apenas administradores podem configurar módulos"});
  const modulo=String(req.body?.modulo||"");
  if(!Object.hasOwn(moduleDefaults,modulo))return res.status(400).json({error:"Módulo inválido"});
  const config={...moduleDefaults[modulo],...(req.body?.configuracao||{})};
  db.prepare(`INSERT INTO empresa_module_config(empresa_id,modulo,configuracao,ativo)
    VALUES(?,?,?,?) ON CONFLICT(empresa_id,modulo) DO UPDATE SET configuracao=excluded.configuracao,
    ativo=excluded.ativo,updated_at=datetime('now')`).run(Number(req.params.id),modulo,JSON.stringify(config),req.body?.ativo===false?0:1);
  res.json({ok:true,modulo,configuracao:config});
});
router.post("/:id/modulos",(req,res)=>{
  if(req.user?.role!=="admin")return res.status(403).json({error:"Apenas administradores podem replicar módulos"});
  const modulo=String(req.body?.modulo||""),destinos=(req.body?.destinos||[]).map(Number).filter(Boolean);
  if(!Object.hasOwn(moduleDefaults,modulo)||!destinos.length)return res.status(400).json({error:"Módulo e destinos são obrigatórios"});
  const source=db.prepare("SELECT configuracao,ativo FROM empresa_module_config WHERE empresa_id=? AND modulo=?").get(Number(req.params.id),modulo);
  const config=source?.configuracao||JSON.stringify(moduleDefaults[modulo]),active=source?.ativo??1;
  const save=db.prepare(`INSERT INTO empresa_module_config(empresa_id,modulo,configuracao,ativo) VALUES(?,?,?,?)
    ON CONFLICT(empresa_id,modulo) DO UPDATE SET configuracao=excluded.configuracao,ativo=excluded.ativo,updated_at=datetime('now')`);
  for(const target of destinos)if(db.prepare("SELECT id FROM empresas WHERE id=?").get(target))save.run(target,modulo,config,active);
  res.json({ok:true,replicados:destinos.length});
});
router.delete("/:id",(req,res)=>{
  if(req.user?.role!=="admin")return res.status(403).json({error:"Apenas administradores podem excluir"});
  const count=db.prepare("SELECT COUNT(*) total FROM empresas WHERE empresa_matriz_id=?").get(Number(req.params.id)).total;
  if(count)return res.status(409).json({error:"Exclua ou mova as filiais antes de excluir a matriz"});
  db.prepare("DELETE FROM empresas WHERE id=?").run(Number(req.params.id));
  res.json({ok:true});
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
