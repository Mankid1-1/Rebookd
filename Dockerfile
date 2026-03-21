### Multi-stage Dockerfile for Rebookd
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production

# Install specific pnpm version from package.json
RUN npm install -g pnpm@10.4.1

# Copy package files and install deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build && npx esbuild server/migrate.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/migrate.js

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built artifacts and node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3000

# Run migrations, then start server
CMD sh -c "node dist/migrate.js && node dist/index.js"
