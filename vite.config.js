import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    // 切分 vendor chunk 后，`@dbml/core`（~11MB，含 MySQL/MSSQL/Postgres/Snowflake 4 套 ANTLR 解析器）
    // 与 `node-sql-parser`（~2.4MB）固有体积较大；已通过动态 import 仅在用户
    // 实际触发 SQL/DBML 导入导出时按需加载。这里把警告阈值放宽到能容纳这两个
    // 异步 chunk 的值，避免构建器在明知可异步加载的情况下仍误报警。
    chunkSizeWarningLimit: 15000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Semi UI 套件拆出，便于浏览器并行加载 + 长期缓存
          if (
            id.includes("/node_modules/@douyinfe/semi-ui/") ||
            id.includes("/node_modules/@douyinfe/semi-icons/") ||
            id.includes("/node_modules/@douyinfe/semi-illuminate/")
          ) {
            return "semi-ui-vendor";
          }
          // Monaco 编辑器只在 CodeEditor / Migration 打开时使用，但静态依赖较重
          if (id.includes("/node_modules/@monaco-editor/")) {
            return "monaco-vendor";
          }
          // Lexical 富文本编辑器，仅在 bug report / 自定义富文本场景
          if (
            id.includes("/node_modules/lexical/") ||
            id.includes("/node_modules/@lexical/")
          ) {
            return "lexical-vendor";
          }
          // SQL/DBML 解析器：`node-sql-parser` 体积 ~13MB，由调用方动态 import，
          // 这里不要强制合到一个 manual chunk，避免阻止按入口切分。
          // 仅对体积较小的 oracle-sql-parser / @dbml/core 继续合并以提高缓存命中率。
          if (
            id.includes("/node_modules/oracle-sql-parser/") ||
            id.includes("/node_modules/@dbml/core/")
          ) {
            return "parser-vendor";
          }
          // 导出 / 文件生成相关
          if (
            id.includes("/node_modules/jspdf/") ||
            id.includes("/node_modules/jszip/") ||
            id.includes("/node_modules/html-to-image/") ||
            id.includes("/node_modules/file-saver/")
          ) {
            return "export-vendor";
          }
          // 图布局
          if (id.includes("/node_modules/@dagrejs/")) {
            return "layout-vendor";
          }
          // React 生态
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react-router") ||
            id.includes("/node_modules/react-i18next/") ||
            id.includes("/node_modules/react-hotkeys-hook/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          return undefined;
        },
      },
    },
  },
});
