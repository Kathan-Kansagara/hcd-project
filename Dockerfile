# =============================================================================
# Zenon Management Portal - API Dockerfile (Production)
# =============================================================================
# Multi-stage build optimized for pnpm monorepo with Prisma
# =============================================================================

# ── Stage 1: Base ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

# Copy workspace config files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./

# Copy all package.json files for dependency resolution
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/validators/package.json ./packages/validators/
COPY packages/database/package.json ./packages/database/

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM base AS build

# Install ALL dependencies (need prisma CLI which is a devDependency)
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY packages/validators ./packages/validators
COPY packages/database ./packages/database

# Generate Prisma client
RUN cd packages/database && pnpm exec prisma generate

# Build the API (TypeScript → JavaScript)
RUN pnpm --filter @zenon/api build

# ── Stage 3: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS production

# Install system dependencies required by Prisma and the app
RUN apk add --no-cache dumb-init curl openssl libc6-compat

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

# Copy workspace config
COPY --from=base /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml /app/turbo.json ./

# Copy all package.json files
COPY --from=base /app/apps/api/package.json ./apps/api/
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/validators/package.json ./packages/validators/
COPY --from=base /app/packages/database/package.json ./packages/database/

# Install ALL dependencies (not --prod, because prisma generate needs the CLI)
RUN pnpm install --frozen-lockfile

# Copy built API output
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Copy package source files (needed at runtime for imports)
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/packages/validators/src ./packages/validators/src
COPY --from=build /app/packages/database/src ./packages/database/src

# Copy Prisma schema and migrations
COPY --from=build /app/packages/database/prisma ./packages/database/prisma

# Generate Prisma client INSIDE the production container
# This guarantees it matches the Alpine Linux OS and is in the correct pnpm path
RUN cd packages/database && pnpm exec prisma generate

# Create required directories
RUN mkdir -p /app/uploads /app/logs && chown -R node:node /app/uploads /app/logs

# Switch to non-root user
USER node

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the API server
CMD ["node", "apps/api/dist/index.js"]
