// =============================================================================
//  routes/dashboard.routes.js — agregados para o dashboard
// =============================================================================
import { Router } from "express";
import * as dashboard from "../services/dashboard.service.js";

const router = Router();

router.get("/kpis", (req, res) => res.json(dashboard.kpis(req.tenantFilter)));
router.get("/por-mes", (req, res) => res.json(dashboard.porMes(req.query.ultimos, req.tenantFilter)));
router.get("/por-uf", (req, res) => res.json(dashboard.porUf(req.tenantFilter)));
router.get("/top-parceiros", (req, res) => res.json(dashboard.topParceiros({
  papel: req.query.papel || "destinatario",
  limite: req.query.limite || 10,
}, req.tenantFilter)));
router.get("/por-status", (req, res) => res.json(dashboard.porStatus(req.tenantFilter)));

export default router;
