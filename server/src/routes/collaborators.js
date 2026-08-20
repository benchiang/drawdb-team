// Collaborators REST
// 挂在 /api/diagrams/:diagramId/collaborators
// 仅 owner 可管理协作者
// mergeParams: true 是为了拿到父路径的 :diagramId
import { Router } from "express";
import { getDb, diagramAccessOf } from "../db.js";
import { authRequired } from "../auth.js";

const router = Router({ mergeParams: true });
router.use(authRequired);

function ownerOf(req) {
  return req.user.sub;
}

// 列出协作者
router.get("/", (req, res) => {
  const db = getDb();
  const role = diagramAccessOf(db, req.params.diagramId, ownerOf(req));
  if (!role) return res.status(404).json({ error: "not_found" });
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.role AS user_role, c.created_at
         FROM diagram_collaborators c
         JOIN users u ON u.id = c.user_id
        WHERE c.diagram_id = ?
        ORDER BY c.created_at ASC`,
    )
    .all(req.params.diagramId);
  res.json({ items: rows });
});

// 添加协作者（按 username）
router.post("/", (req, res) => {
  const db = getDb();
  const role = diagramAccessOf(db, req.params.diagramId, ownerOf(req));
  if (role !== "owner") {
    return res.status(403).json({ error: "owner_only" });
  }
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: "missing_username" });
  const target = db
    .prepare("SELECT id, username, role FROM users WHERE username = ?")
    .get(username);
  if (!target) return res.status(404).json({ error: "user_not_found" });
  if (target.id === ownerOf(req)) {
    return res.status(400).json({ error: "cannot_share_with_self" });
  }
  try {
    db.prepare(
      "INSERT INTO diagram_collaborators (diagram_id, user_id) VALUES (?, ?)",
    ).run(req.params.diagramId, target.id);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "already_collaborator" });
    }
    throw err;
  }
  res.status(201).json({
    id: target.id,
    username: target.username,
    user_role: target.role,
    created_at: new Date().toISOString(),
  });
});

// 移除协作者
router.delete("/:userId", (req, res) => {
  const db = getDb();
  const role = diagramAccessOf(db, req.params.diagramId, ownerOf(req));
  if (role !== "owner") {
    return res.status(403).json({ error: "owner_only" });
  }
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: "invalid_user_id" });
  }
  const result = db
    .prepare(
      "DELETE FROM diagram_collaborators WHERE diagram_id = ? AND user_id = ?",
    )
    .run(req.params.diagramId, userId);
  if (result.changes === 0) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
});

export default router;
