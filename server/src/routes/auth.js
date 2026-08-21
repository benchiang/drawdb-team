// Auth REST
import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb, hasAnyUser } from "../db.js";
import { signToken, authRequired } from "../auth.js";

const router = Router();

// GET /api/auth/bootstrap —— 判断是否需要初始化管理员
router.get("/bootstrap", (req, res) => {
  const db = getDb();
  res.json({ initialized: hasAnyUser(db) });
});

// POST /api/auth/bootstrap —— 首次创建管理员账号（仅当 users 表为空时允许）
router.post("/bootstrap", (req, res) => {
  const db = getDb();
  if (hasAnyUser(db)) {
    return res.status(409).json({ error: "already_initialized" });
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "missing_credentials" });
  }
  if (username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: "credentials_too_weak" });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
    )
    .run(username, hash);
  const user = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(info.lastInsertRowid);
  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  res.json({ token, user });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "missing_credentials" });
  }
  const db = getDb();
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });
  const token = signToken({ sub: user.id, username: user.username, role: user.role });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.get("/me", authRequired, (req, res) => {
  const db = getDb();
  const user = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(req.user.sub);
  if (!user) return res.status(401).json({ error: "invalid_token" });
  res.json({ user });
});

// POST /api/auth/password —— 登录用户修改自己的密码
// Body: { currentPassword, newPassword }
router.post("/password", authRequired, (req, res) => {
  const db = getDb();
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "missing_credentials" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 4) {
    return res.status(400).json({ error: "credentials_too_weak" });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "password_unchanged" });
  }
  const user = db
    .prepare("SELECT id, password_hash FROM users WHERE id = ?")
    .get(req.user.sub);
  if (!user) return res.status(401).json({ error: "invalid_token" });
  const ok = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    newHash,
    user.id,
  );
  res.json({ ok: true });
});

export default router;
