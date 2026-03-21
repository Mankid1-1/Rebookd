# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@10.4.1

COPY package.json pnpm-lock.yaml* ./
# Install ALL deps (dev needed for build)
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build \
  && npx esbuild server/migrate.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/migrate.js

# ─── Stage 2: Production deps only ────────────────────────────────────────────
FROM node:20-alpine AS prod-deps
WORKDIR /app

RUN npm install -g pnpm@10.4.1

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# ─── Stage 3: Migration runner (minimal image) ────────────────────────────────
FROM node:20-alpine AS migrate
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist/migrate.js ./dist/migrate.js
COPY --from=builder /app/drizzle ./drizzle
COPY package.json ./

CMD ["node", "dist/migrate.js"]

# ─── Stage 4: App runner ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY package.json ./

EXPOSE 3000

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const fs=require('fs');const t=fs.statSync('/tmp/worker-heartbeat',{throwIfNoEntry:false})?.mtimeMs??0;process.exit(Date.now()-t<120000?0:1)" 2>/dev/null || exit 1

CMD ["node", "dist/index.js"]
