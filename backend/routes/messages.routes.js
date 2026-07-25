import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS user_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_pair
    ON user_messages(sender_id, recipient_id, created_at);
`);

router.get("/users", (req, res) => {
  const rows = db.prepare(`
    SELECT DISTINCT u.id, u.username, u.nome, u.email, u.avatar_path, u.role,
      (SELECT COUNT(*) FROM user_messages m
       WHERE m.sender_id = u.id AND m.recipient_id = ? AND m.read_at IS NULL) unread
    FROM users u
    LEFT JOIN empresa_users eu ON eu.user_id = u.id AND eu.ativo = 1
    WHERE u.ativo = 1 AND u.id != ?
      AND (? = 1 OR eu.empresa_id = ?)
    ORDER BY unread DESC, u.nome, u.username
  `).all(req.user.id, req.user.id, req.isSuperAdmin ? 1 : 0, req.tenantId || -1);
  res.json(rows.map((row) => ({
    ...row,
    avatar_url: row.avatar_path ? `/api/${row.avatar_path}` : null,
  })));
});

router.get("/thread/:userId", (req, res) => {
  const otherId = Number(req.params.userId);
  const allowed = db.prepare("SELECT id FROM users WHERE id = ? AND ativo = 1").get(otherId);
  if (!allowed) return res.status(404).json({ error: "Usuário não encontrado" });
  db.prepare(`
    UPDATE user_messages SET read_at = datetime('now')
    WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL
  `).run(otherId, req.user.id);
  const rows = db.prepare(`
    SELECT id, sender_id, recipient_id, content, read_at, created_at
    FROM user_messages
    WHERE (sender_id = ? AND recipient_id = ?)
       OR (sender_id = ? AND recipient_id = ?)
    ORDER BY id ASC LIMIT 300
  `).all(req.user.id, otherId, otherId, req.user.id);
  res.json(rows);
});

router.post("/", (req, res) => {
  const recipientId = Number(req.body?.recipientId);
  const content = String(req.body?.content || "").trim().slice(0, 3000);
  if (!recipientId || !content)
    return res.status(400).json({ error: "Destinatário e mensagem são obrigatórios" });
  if (recipientId === req.user.id)
    return res.status(400).json({ error: "Selecione outro usuário" });
  const recipient = db.prepare("SELECT id FROM users WHERE id = ? AND ativo = 1").get(recipientId);
  if (!recipient) return res.status(404).json({ error: "Usuário não encontrado" });
  const info = db.prepare(`
    INSERT INTO user_messages (sender_id, recipient_id, content)
    VALUES (?, ?, ?)
  `).run(req.user.id, recipientId, content);
  res.json({
    id: Number(info.lastInsertRowid),
    sender_id: req.user.id,
    recipient_id: recipientId,
    content,
    created_at: new Date().toISOString(),
  });
});

router.get("/status/unread", (req, res) => {
  const row = db.prepare(`
    SELECT COUNT(*) total FROM user_messages
    WHERE recipient_id = ? AND read_at IS NULL
  `).get(req.user.id);
  res.json({ unread: Number(row?.total || 0) });
});

export default router;
