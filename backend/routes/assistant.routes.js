import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();
const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

function answer(message, user) {
  const q = message.toLowerCase();
  const stats = () => {
    try {
      const row = db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN status='autorizado' THEN 1 ELSE 0 END) autorizados FROM documents").get();
      return `Há ${row.total || 0} documentos cadastrados, sendo ${row.autorizados || 0} autorizados.`;
    } catch { return "Não consegui carregar os indicadores agora."; }
  };
  if (/ol[aá]|bom dia|boa tarde|boa noite/.test(q)) return `Olá, ${user.nome || user.username}! Sou o assistente Cordeiro. Posso ajudar com consultas, XML, relatórios, SEFAZ, NFS-e e uso do sistema.`;
  if (/quantos|indicador|resumo|documentos cadastrados/.test(q)) return stats();
  if (/nfs.?e|nota de servi[cç]o/.test(q)) return "Para NFS-e, use Integrações > NFS-e Nacional. A consulta oficial exige certificado digital compatível e vínculo do CNPJ no ADN. Configure primeiro o ambiente e o certificado da empresa.";
  if (/sefaz|cte|ct-e|nfe|nf-e/.test(q)) return "Abra Integrações, escolha SEFAZ e informe a chave de 44 dígitos. Para baixar documentos destinados à empresa, configure um certificado A1 e use a distribuição DF-e por NSU.";
  if (/xml|baixar/.test(q)) return "Em Documentos fiscais, localize a nota pela chave, número ou emitente e clique no ícone de download. O XML original será baixado com autenticação e empresa ativa.";
  if (/relat[oó]rio|excel|csv|pdf/.test(q)) return "Na Central de relatórios você pode escolher NF-e, CT-e ou todos os documentos e exportar em Excel, CSV ou PDF.";
  if (/perfil|linkedin|rede social/.test(q)) return "Abra Meu perfil para personalizar nome, cargo, área, biografia, LinkedIn, Instagram, site e telefone.";
  if (/feedback|sugest[aã]o|problema|bug/.test(q)) return "Use a aba Feedback para enviar uma sugestão, dúvida ou erro. Você acompanha o status e a resposta da equipe no mesmo lugar.";
  return "Posso orientar sobre: consulta e download de NF-e/CT-e/NFS-e, importação de XML, relatórios, perfil, empresas, usuários e feedback. Descreva o que deseja fazer.";
}

function fiscalContext(req) {
  try {
    const empresaId = req.empresa?.id;
    const row = empresaId
      ? db.prepare(`
          SELECT COUNT(*) total,
                 SUM(CASE WHEN status = 'autorizado' THEN 1 ELSE 0 END) autorizados,
                 SUM(CASE WHEN cancelado = 1 THEN 1 ELSE 0 END) cancelados,
                 MAX(data_emissao) ultima_emissao
          FROM documents WHERE empresa_id = ?
        `).get(empresaId)
      : db.prepare(`
          SELECT COUNT(*) total,
                 SUM(CASE WHEN status = 'autorizado' THEN 1 ELSE 0 END) autorizados,
                 SUM(CASE WHEN cancelado = 1 THEN 1 ELSE 0 END) cancelados,
                 MAX(data_emissao) ultima_emissao
          FROM documents
        `).get();
    return {
      empresa: req.empresa?.nome || "não selecionada",
      totalDocumentos: row?.total || 0,
      autorizados: row?.autorizados || 0,
      cancelados: row?.cancelados || 0,
      ultimaEmissao: row?.ultima_emissao || null,
    };
  } catch {
    return { empresa: req.empresa?.nome || "não selecionada" };
  }
}

async function aiAnswer(message, req) {
  const history = db.prepare(`
    SELECT role, content FROM assistant_messages
    WHERE user_id = ? ORDER BY id DESC LIMIT 12
  `).all(req.user.id).reverse();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    if (!process.env.OPENAI_API_KEY) {
      const tags = await fetch("http://127.0.0.1:11434/api/tags", {
        signal: controller.signal,
      }).then((response) => response.json());
      const model = process.env.OLLAMA_MODEL || tags.models?.[0]?.name;
      if (!model) return null;
      const response = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          think: false,
          messages: [
            {
              role: "system",
              content: `Você é o Assistente Cordeiro, especialista em documentos fiscais brasileiros e no sistema Cordeiro Fiscal. Responda em português, com objetividade, sem inventar dados. Contexto: ${JSON.stringify(fiscalContext(req))}`,
            },
            ...history,
          ],
          options: { temperature: 0.35 },
        }),
      });
      if (!response.ok) throw new Error(`Ollama ${response.status}`);
      const data = await response.json();
      return data.message?.content || null;
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        instructions: `Você é o Assistente Cordeiro, especialista em operação do sistema Cordeiro Fiscal e documentos fiscais brasileiros.
Responda sempre em português do Brasil, de forma objetiva, segura e prática.
Ajude com NF-e, CT-e, NFS-e, MDF-e, XML, DANFE, SEFAZ, certificado digital, relatórios, importações e navegação no sistema.
Use o contexto da empresa apenas para responder ao usuário autenticado. Não invente dados, não dê parecer jurídico ou contábil definitivo e recomende validação profissional quando necessário.
Nunca solicite senha de certificado, chave de API ou outro segredo.
Contexto atual: ${JSON.stringify(fiscalContext(req))}`,
        input: history.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        reasoning: { effort: "low" },
        text: { verbosity: "medium" },
        max_output_tokens: 900,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const data = await response.json();
    return data.output_text ||
      data.output?.flatMap((item) => item.content || [])
        .find((item) => item.type === "output_text")?.text ||
      null;
  } finally {
    clearTimeout(timer);
  }
}

router.get("/history", (req, res) => {
  const rows = db.prepare("SELECT id, role, content, created_at FROM assistant_messages WHERE user_id = ? ORDER BY id DESC LIMIT 60").all(req.user.id).reverse();
  res.json({ messages: rows });
});

router.post("/message", async (req, res) => {
  const message = String(req.body?.message || "").trim().slice(0, 1500);
  if (!message) return res.status(400).json({ error: "Digite uma mensagem" });
  db.prepare("INSERT INTO assistant_messages (user_id, role, content) VALUES (?, 'user', ?)").run(req.user.id, message);
  let content;
  let poweredByAI = false;
  try {
    content = await aiAnswer(message, req);
    poweredByAI = Boolean(content);
  } catch (error) {
    console.error("[assistant] IA indisponível:", error.message);
  }
  content ||=
    "A IA ainda não está conectada neste servidor. Configure OPENAI_API_KEY ou mantenha o Ollama ativo para receber respostas automáticas.";
  const info = db.prepare("INSERT INTO assistant_messages (user_id, role, content) VALUES (?, 'assistant', ?)").run(req.user.id, content);
  res.json({
    message: {
      id: Number(info.lastInsertRowid),
      role: "assistant",
      content,
      poweredByAI,
      created_at: new Date().toISOString(),
    },
  });
});

router.get("/status", async (req, res) => {
  if (process.env.OPENAI_API_KEY) {
    return res.json({ ai: true, provider: "OpenAI", model: AI_MODEL });
  }
  try {
    const data = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(1200),
    }).then((response) => response.json());
    const model = process.env.OLLAMA_MODEL || data.models?.[0]?.name;
    return res.json({ ai: Boolean(model), provider: "Ollama", model: model || null });
  } catch {
    return res.json({ ai: false, provider: null, model: null });
  }
});

router.delete("/history", (req, res) => {
  db.prepare("DELETE FROM assistant_messages WHERE user_id = ?").run(req.user.id);
  res.json({ ok: true });
});

export default router;
