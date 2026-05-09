# Multi-stage build for production API
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY turbo.json ./

# Copy package files for dependency installation
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/validators/package.json ./packages/validators/
COPY packages/database/package.json ./packages/database/

# Install dependencies
FROM base AS dependencies
RUN pnpm install --frozen-lockfile

# Build stage
FROM dependencies AS build

# Copy source code
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY packages/validators ./packages/validators
COPY packages/database ./packages/database

# Generate Prisma client
RUN cd packages/database && pnpm exec prisma generate

# Build API
RUN pnpm --filter @zenon/api build

# Production stage
FROM node:22-alpine AS production

# Install pnpm and dumb-init
RUN corepack enable && \
    corepack prepare pnpm@10.19.0 --activate && \
    apk add --no-cache dumb-init curl

WORKDIR /app

# Copy package files
COPY --from=base /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
COPY --from=base /app/apps/api/package.json ./apps/api/
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/validators/package.json ./packages/validators/
COPY --from=base /app/packages/database/package.json ./packages/database/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/packages/validators/src ./packages/validators/src
COPY --from=build /app/packages/database/src ./packages/database/src
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Create logs directory
RUN mkdir -p /app/logs && chown -R node:node /app/logs

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/api/dist/index.js"]
