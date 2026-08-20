// 简单的配置层。优先读环境变量，否则回落到默认值。
// 严禁使用 secret_ref / 引用模式 —— 直接明文。
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || "drawdb-local-dev-secret-please-change",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  // SQLite 文件路径（持久化到本地的真正 .db 文件）
  dbPath: process.env.DB_PATH || path.join(__dirname, "..", "data", "drawdb.sqlite"),
  // 单用户模式：首次启动时若 users 表为空，用下面这个账号初始化
  bootstrap: {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin",
  },
  // CORS：开发期 Vite 5173
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};

export function ensureDataDir() {
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
