// =============================================================================
//  app.js — configuração do Express e montagem dos routers
// =============================================================================
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { readSession, requireAuth } from "./middleware/auth.js";

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import empresasRoutes from "./routes/empresas.routes.js";
import docsRoutes from "./routes/docs.routes.js";
import consultaRoutes from "./routes/consulta.routes.js";
import pdfRoutes from "./routes/pdf.routes.js";
import generateRoutes from "./routes/generate.routes.js";
import sefazMonitorRoutes from "./routes/sefaz-monitor.routes.js";
import meudanfeRoutes from "./routes/meudanfe.routes.js";
import relatoriosRoutes from "./routes/relatorios.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import newsRoutes from "./routes/news.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import assistantRoutes from "./routes/assistant.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import certidoesRoutes from "./routes/certidoes.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// A interface React compilada é a experiência principal. A versão anterior
// permanece preservada em /frontend para permitir retorno seguro se necessário.
const FRONTEND_DIR = path.resolve(__dirname, "..", "frontend-modern", "dist");
const DATA_DIR = path.resolve(__dirname, "..", "data");

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "20mb" }));
  app.use(express.text({ type: ["text/xml", "application/xml"], limit: "20mb" }));

  // Serve avatares (upload de foto de perfil) sob /api/avatars/...
  // Público, pois é carregado em <img src> sem precisar de cookie de sessão.
  app.use("/api/avatars", express.static(path.join(DATA_DIR, "avatars")));

  // Lê sessão (se houver) e anexa req.user
  app.use(readSession);

  // ---- Rotas API ----
  // Públicas (sem auth) — login/cadastro
  app.use("/api/auth", authRoutes);
  app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // Demais rotas /api/* exigem autenticação.
  // Usamos um guard global que checa req.originalUrl e libera os paths da lista branca.
  app.use("/api", requireAuth);

  // Notícias (público — registrado DEPOIS do requireAuth, que libera os paths da lista)
  app.use("/api/news", newsRoutes);

  // Demais rotas protegidas
  app.use("/api/users", usersRoutes);
  app.use("/api/empresas", empresasRoutes);
  app.use("/api/docs", docsRoutes);
  app.use("/api/consulta", consultaRoutes);
  app.use("/api/pdf", pdfRoutes);
  app.use("/api/generate", generateRoutes);
  // Integração direta com a SEFAZ deliberadamente desativada.
  // Não monte rotas que enviem SOAP, chaves, certificados ou consultas ao fisco.
  app.all("/api/sefaz/*", (_req, res) => {
    res.status(410).json({
      error: "Integração direta com a SEFAZ desativada neste sistema.",
    });
  });
  app.use("/api/sefaz-monitor", sefazMonitorRoutes);
  app.use("/api/meudanfe", meudanfeRoutes);
  app.use("/api/relatorio", relatoriosRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/feedback", feedbackRoutes);
  app.use("/api/assistant", assistantRoutes);
  app.use("/api/messages", messagesRoutes);
  app.use("/api/certidoes", certidoesRoutes);

  // 404 para APIs inexistentes
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Endpoint não encontrado" });
    next();
  });

  // ---- Frontend estático ----
  app.use(express.static(FRONTEND_DIR));

  // SPA fallback: qualquer rota não-API serve o index.html (deixa o roteador hash cuidar)
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Endpoint não encontrado" });
    res.sendFile(path.join(FRONTEND_DIR, "index.html"));
  });

  return app;
}
