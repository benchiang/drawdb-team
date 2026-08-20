// Users 管理（仅 admin）
// GET    /api/users/search?q=    用户名搜索（任何已登录用户，用于协作者邀请）
// GET    /api/users              列表（admin）
// POST   /api/users              创建（admin）
// PATCH  /api/users/:id          改密码或角色（admin）
// DELETE /api/users/:id          删除（admin）
import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { authRequired, adminRequired } from "../auth.js";

const router = Router();
router.use(authRequired);

// 协作者邀请用：按 username 模糊搜索，返回不包含敏感字段的用户
// 不限 admin，因为普通用户也需要查找其他用户名来分享
router.get("/search", (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ items: [] });
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, username, role
         FROM users
        WHERE username LIKE ? OR CAST(id AS TEXT) = ?
        ORDER BY username ASC
        LIMIT 20`,
    )
    .all(`%${q}%`, q);
  res.json({ items: rows });
});

// 以下所有 /api/users/* 都需要 admin
router.use(adminRequired);

router.get("/", (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, username, role, created_at FROM users ORDER BY id ASC",
    )
    .all();
  res.json({ items: rows });
});

router.post("/", (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "missing_credentials" });
  }
  if (username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: "credentials_too_weak" });
  }
  const finalRole = role === "admin" ? "admin" : "user";
  const db = getDb();
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) return res.status(409).json({ error: "username_taken" });
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
    )
    .run(username, hash, finalRole);
  const created = db
    .prepare("SELECT id, username, role, created_at FROM users WHERE id = ?")
    .get(info.lastInsertRowid);
  res.status(201).json(created);
});

router.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
  const db = getDb();
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ error: "not_found" });
  const updates = {};
  if (typeof req.body?.password === "string" && req.body.password.length >= 4) {
    updates.password_hash = bcrypt.hashSync(req.body.password, 10);
  }
  if (req.body?.role === "admin" || req.body?.role === "user") {
    if (target.role === "admin" && req.body.role !== "admin") {
      const otherAdmins = db
        .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?")
        .get(id);
      if (otherAdmins.n === 0) {
        return res.status(400).json({ error: "cannot_demote_last_admin" });
      }
    }
    updates.role = req.body.role;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "no_changes" });
  }
  const sets = Object.keys(updates)
    .map((k) => `${k} = @${k}`)
    .join(", ");
  db.prepare(`UPDATE users SET ${sets} WHERE id = @id`).run({ ...updates, id });
  const updated = db
    .prepare("SELECT id, username, role, created_at FROM users WHERE id = ?")
    .get(id);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid_id" });
  if (id === req.user.sub) {
    return res.status(400).json({ error: "cannot_delete_self" });
  }
  const db = getDb();
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!target) return res.status(404).json({ error: "not_found" });
  if (target.role === "admin") {
    const otherAdmins = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?")
      .get(id);
    if (otherAdmins.n === 0) {
      return res.status(400).json({ error: "cannot_delete_last_admin" });
    }
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.status(204).end();
});

export default router;
