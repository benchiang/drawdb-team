// ESLint v9 flat config
// 取代旧 .eslintrc.cjs：仅扫描 .js / .jsx / .mjs / .cjs，
// 通过 files 字段限定入口避免 linter 把 config 文件也当源码扫。
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

const SRC_GLOB = ["src/**/*.{js,jsx,mjs,cjs}"];
const SERVER_GLOB = ["server/**/*.{js,jsx,mjs,cjs}"];
const CONFIG_GLOB = ["*.{js,jsx,mjs,cjs}", "**/*.config.{js,jsx,mjs,cjs}"];

export default [
  // 全局忽略：构建产物 / SQLite 数据目录 / 旧 .eslintrc 自身
  {
    ignores: [
      "dist/**",
      "server/data/**",
      "node_modules/**",
      ".eslintrc.cjs",
    ],
  },

  // 源码（前端）
  {
    files: SRC_GLOB,
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "18.2" },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      // 保持与旧配置一致：常量子组件允许 export
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react/prop-types": 0,
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // 后端 ESM：Node 运行时，不打开浏览器全局
  {
    files: SERVER_GLOB,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // 构建/项目配置文件（Vite、Tailwind、PostCSS 等）
  {
    files: CONFIG_GLOB,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },

  // 必须放最后，关闭与 Prettier 冲突的规则
  prettier,
];
