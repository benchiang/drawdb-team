# Stage 1: Build the frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Install server production dependencies only
FROM node:20-alpine AS server-deps
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Stage 3: Runtime - Express serves both API and built frontend
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# better-sqlite3 needs build tools / prebuilt for alpine; node:20-alpine ships prebuilt binaries
RUN apk add --no-cache python3 make g++ \
    && npm install -g npm@10

# Copy server runtime
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/

# Copy frontend build
COPY --from=build /app/dist ./dist

EXPOSE 3001
# data dir is a mount point; ensureDataDir() creates it on first start
RUN mkdir -p /app/server/data
VOLUME ["/app/server/data"]

CMD ["node", "server/src/index.js"]
