<div align="center">
  <sup>特别鸣谢：</sup>
  <br>
  <a href="https://www.warp.dev/drawdb/" target="_blank">
    <img alt="Warp 赞助" width="280" src="https://github.com/user-attachments/assets/c7f141e7-9751-407d-bb0e-d6f2c487b34f">
    <br>
    <b>面向全平台的下一代 AI 智能终端</b>
  </a>
</div>

<br/>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<br/>

<div align="center">
    <img width="64" alt="drawDB logo" src="./src/assets/icon-dark.png">
    <h1>drawDB</h1>
</div>

<h3 align="center">免费、简洁、直观的数据库结构图编辑器与 SQL 生成器。</h3>

<div align="center" style="margin-bottom:12px;">
    <a href="https://drawdb.app/" style="display: flex; align-items: center;">
        <img src="https://img.shields.io/badge/开始使用-grey" alt="drawDB"/>
    </a>
    <a href="https://discord.gg/BrjZgNrmR6" style="display: flex; align-items: center;">
        <img src="https://img.shields.io/discord/1196658537208758412.svg?label=加入%20Discord&logo=discord" alt="Discord"/>
    </a>
    <a href="https://x.com/drawDB_" style="display: flex; align-items: center;">
        <img src="https://img.shields.io/badge/在%20X%20上关注-blue?logo=X" alt="关注我们"/>
    </a>
</div>

<p align="center">
  <sub>🍴 本项目是 <a href="https://github.com/drawdb-io/drawdb">drawdb-io/drawdb</a> 的分支，在原版基础上新增了多用户账户、JWT 认证、SQLite 持久化与图协作编辑功能。</sub>
</p>

<h3 align="center"><img width="700" style="border-radius:5px;" alt="drawDB 截图" src="drawdb.png"></h3>

drawDB 是一个强大且易用的数据库实体关系图（ERD）编辑器，完全在浏览器中运行。几次点击即可构建图、导入/导出 SQL 脚本、生成迁移脚本、自定义编辑器，无需注册账号。

> 本分支在原版基础上新增了**多用户账户、JWT 认证、SQLite 持久化、以及图协作编辑**功能——彻底替换了原 Gist 分享模式，改用内置用户系统 + 每图独立的协作者管理。

## 功能特性

- 可视化 ERD 编辑器，支持 SQL 导入/导出、DBML、迁移脚本生成
- 多用户账户系统，支持 **管理员 / 普通成员** 两种角色
- 每图独立的**协作者管理**——按用户名邀请其他用户共同编辑
- 本地 SQLite 持久化（数据保存在你的服务器，不在浏览器里）
- JWT 认证（默认 token 有效期 7 天）
- Docker 单镜像部署（一个进程同时托管 API 与前端）

## 快速开始

### 本地开发

需要 **Node.js 20+**。

```bash
git clone https://github.com/drawdb-io/drawdb
cd drawdb
npm install
npm run dev
```

`npm run dev` 会同时启动两个进程：

- **Vite 开发服务器**：`http://localhost:5173`（前端 + HMR 热更新）
- **Express API 服务器**：`http://localhost:3001`（认证、图、协作者、模板）

Vite 自动把 `/api/*` 代理到 Express，所以浏览器只需要打开 `http://localhost:5173`。

**首次使用：** 打开应用会跳转到 `/login`。由于数据库是空的，登录页会显示「创建管理员」表单——用默认账号 `admin` / `admin` 即可（生产环境请改强密码）。

### 生产构建

```bash
npm install
npm run build      # 把前端构建到 ./dist
```

生产环境下，Express 服务器（`server/src/index.js`）会自动检测 `./dist` 是否存在，若存在则直接托管静态资源，并对所有非 `/api` 路径做 SPA fallback（回退到 `index.html`）。**无需 Nginx**。

```bash
node server/src/index.js   # 同时提供 API 与前端，监听 :3001
```

### Docker 部署

```bash
docker build -t drawdb .
docker run -d \
  --name drawdb \
  -p 3001:3001 \
  -v drawdb-data:/app/server/data \
  --restart unless-stopped \
  drawdb
```

镜像会构建前端、安装服务端生产依赖（不含 devDependencies）、启动 Express 监听 `3001`。SQLite 数据库存在命名卷 `drawdb-data` 的 `/app/server/data` 路径下。

- 浏览器打开 `http://localhost:3001`
- 首次访问会显示「创建管理员」表单 → 提交后创建初始管理员
- 后续访问显示登录页

> 也提供了 `compose.yml` 作为便捷方式——同一镜像、同一卷，只是声明式语法。两种方式任选其一。

**配置项**（[compose.yml](compose.yml) 中按明文写入，禁止使用 secret_ref）：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3001` | Express 监听端口 |
| `JWT_SECRET` | 开发兜底值 | **生产环境必须改** |
| `JWT_EXPIRES_IN` | `7d` | Token 有效期 |
| `ADMIN_USERNAME` | `admin` | 引导管理员用户名 |
| `ADMIN_PASSWORD` | `admin` | **生产环境必须改** |
| `CORS_ORIGIN` | `http://localhost:3001` | 浏览器请求允许的来源 |
| `DB_PATH` | `server/data/drawdb.sqlite` | SQLite 文件位置 |

**备份 SQLite 数据：**

```bash
docker run --rm -v drawdb-data:/d -v $PWD:/o alpine cp /d/drawdb.sqlite /o/backup.sqlite
```

## 多用户与协作

- 通过「创建管理员」流程创建的第一个用户自动成为**管理员**，可以在 `/users` 页面管理所有用户
- 每张图有**所有者**（owner，拥有删除权 + 协作者管理权）和**协作者**（可读 + 可编辑）
- 打开一张图 → 点击右上角「分享」→ 输入用户名 → 下拉框自动联想已有用户 → 选中即可邀请
- 协作者可在 Dashboard 的 **「共享给我」** 分区看到被分享的图

## 贡献

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献规范。

## 支持

- 加入讨论：[Discord](https://discord.gg/BrjZgNrmR6)
