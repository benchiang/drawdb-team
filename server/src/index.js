// DrawDB 本地后端入口
// 多用户模式 + SQLite 持久化 + JWT 认证
// 首次启动 users 表为空，需调用 POST /api/auth/bootstrap 创建管理员
// 生产环境（dist 存在）同时托管前端构建产物
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config, ensureDataDir } from "./config.js";
import { getDb } from "./db.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import diagramsRouter from "./routes/diagrams.js";
import templatesRouter from "./routes/templates.js";
import collaboratorsRouter from "./routes/collaborators.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ensureDataDir();
getDb(); // 触发建表 + 迁移

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: false,
  }),
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/diagrams", diagramsRouter);
app.use("/api/diagrams/:diagramId/collaborators", collaboratorsRouter);
app.use("/api/templates", templatesRouter);

app.use((err, req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "internal_error", message: err?.message });
});

// 生产环境：托管前端构建产物（SPA fallback）
// dist 路径 = 仓库根的 dist/（npm run build 输出）
const distDir = path.resolve(__dirname, "..", "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      maxAge: "1h",
      index: false,
    }),
  );
  // SPA 路由：所有非 /api 路径都回退到 index.html
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
  console.log(`[drawdb-server] serving frontend from ${distDir}`);
}

app.listen(config.port, () => {
  console.log(`[drawdb-server] listening on http://localhost:${config.port}`);
  console.log(`[drawdb-server] sqlite file: ${config.dbPath}`);
});
