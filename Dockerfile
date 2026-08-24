# Stage 1: Build the frontend
FROM node:20-alpine AS build
WORKDIR /app
# .npmrc 在前端 build 阶段和后端 production 阶段都会生效，
# 静默 deprecation / fund 噪音。ENV 兜底应对 .npmrc 未及时 COPY 的场景。
ENV NPM_CONFIG_DEPRECATION=false \
    NPM_CONFIG_FUND=false
COPY package*.json .npmrc ./
RUN npm ci --no-fund --no-audit
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Runtime - Express serves both API and built frontend
# 不再分离 server-deps stage：在本阶段先装 Python/make/g++，再 npm ci --omit=dev
# 这样 better-sqlite3 拿不到 prebuild 时也能本地编译。
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false
# better-sqlite3 编译/链接所需的工具链
# python3 / make / g++ 用于 node-gyp 兜底编译；sqlite 头文件由 better-sqlite3 自带
# 同时安装后端生产依赖（保持层缓存：只要 server/package*.json 未变就复用）
COPY server/package*.json ./server/
# prebuild-install 网络偶发超时，重试一次；仍失败时由 node-gyp 本地编译
RUN apk add --no-cache python3 make g++ \
    && npm install -g npm@10 \
    && cd server \
    && (npm ci --omit=dev --no-fund --no-deprecation --no-audit \
        || (echo "--- npm ci failed once, retrying with --build-from-source ---" \
            && npm ci --omit=dev --no-fund --no-deprecation --no-audit --build-from-source))

# Copy server source (after deps installed so source changes don't bust the layer)
COPY server/ ./server/

# Copy frontend build
COPY --from=build /app/dist ./dist

EXPOSE 3001
# data dir is a mount point; ensureDataDir() creates it on first start
RUN mkdir -p /app/server/data
VOLUME ["/app/server/data"]

CMD ["node", "server/src/index.js"]
