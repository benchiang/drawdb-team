// SQLite 初始化 + 迁移
// 单文件 better-sqlite3，schema 简洁直接；所有业务 ID 均为应用层 UUID。
// users 表：username/password_hash/role；diagrams/templates 按 owner_id 隔离。
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = new Database(config.dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db) {
  // 基础 schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS diagrams (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      database TEXT NOT NULL,
      gist_id TEXT,
      loaded_from_gist_id TEXT,
      last_modified TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_diagrams_owner ON diagrams(owner_id);
    CREATE INDEX IF NOT EXISTS idx_diagrams_last_modified ON diagrams(last_modified);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      database TEXT NOT NULL,
      custom INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_templates_owner ON templates(owner_id);

    CREATE TABLE IF NOT EXISTS diagram_collaborators (
      diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (diagram_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_collab_user ON diagram_collaborators(user_id);
    CREATE INDEX IF NOT EXISTS idx_collab_diagram ON diagram_collaborators(diagram_id);
  `);

  // 兼容旧库：缺列就补上
  ensureColumn(db, "users", "role", "TEXT NOT NULL DEFAULT 'user'");

  // 把旧 diagrams/templates 中 owner_id 为 NULL 或 0 的记录，归到第一个 admin 名下
  // 仅在至少存在一个 admin 时迁移；否则保持原状等待 bootstrap
  const firstAdmin = db
    .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1")
    .get();
  if (firstAdmin) {
    // 旧库中没 owner_id 列的先补
    const diagInfo = db.prepare("PRAGMA table_info(diagrams)").all();
    if (!diagInfo.find((c) => c.name === "owner_id")) {
      db.exec(
        `ALTER TABLE diagrams ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
      );
    }
    const tplInfo = db.prepare("PRAGMA table_info(templates)").all();
    if (!tplInfo.find((c) => c.name === "owner_id")) {
      db.exec(
        `ALTER TABLE templates ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
      );
    }
    // 把 owner_id 为 NULL 的旧数据指给第一个 admin
    db.prepare(
      "UPDATE diagrams SET owner_id = ? WHERE owner_id IS NULL",
    ).run(firstAdmin.id);
    db.prepare(
      "UPDATE templates SET owner_id = ? WHERE owner_id IS NULL",
    ).run(firstAdmin.id);

    // 现在加 NOT NULL 约束需要重建表；先建影子表后替换
    rebuildIfMissingNotNull(db, "diagrams", "owner_id");
    rebuildIfMissingNotNull(db, "templates", "owner_id");
    // 索引可能刚被丢弃，重建
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_diagrams_owner ON diagrams(owner_id);
       CREATE INDEX IF NOT EXISTS idx_templates_owner ON templates(owner_id);`,
    );
  }
}

function ensureColumn(db, table, column, decl) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!info.find((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

function rebuildIfMissingNotNull(db, table, col) {
  // better-sqlite3 不支持直接 ALTER 加 NOT NULL；如果该列目前没 NOT NULL，重建表
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const target = info.find((c) => c.name === col);
  if (!target || target.notnull === 1) return;
  const cols = info.map((c) => c.name);
  const defs = info
    .map(
      (c) =>
        `${c.name} ${c.type}${c.pk ? " PRIMARY KEY" : ""}${
          c.notnull ? " NOT NULL" : ""
        }${c.dflt_value != null ? ` DEFAULT ${c.dflt_value}` : ""}`,
    )
    .join(", ");
  const tmp = `${table}_new`;
  db.exec(`CREATE TABLE ${tmp} (${defs})`);
  db.exec(
    `INSERT INTO ${tmp} (${cols.join(",")}) SELECT ${cols.join(",")} FROM ${table}`,
  );
  db.exec(`DROP TABLE ${table}`);
  db.exec(`ALTER TABLE ${tmp} RENAME TO ${table}`);
}

export function hasAnyUser(db) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  return row.n > 0;
}

// 返回该用户对 diagram 的访问权：'owner' | 'collab' | null
export function diagramAccessOf(db, diagramId, userId) {
  const row = db
    .prepare(
      `SELECT 'owner' AS role FROM diagrams WHERE id = ? AND owner_id = ?
       UNION
       SELECT 'collab' AS role FROM diagram_collaborators WHERE diagram_id = ? AND user_id = ?`,
    )
    .get(diagramId, userId, diagramId, userId);
  return row?.role || null;
}
