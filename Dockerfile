# ==============================================================================
# DATAPILOT PRODUCTION DOCKERFILE
# Multi-stage build for optimal image size and security
# ==============================================================================

# Stage 1: Build Frontend and Server Bundle
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S datapilot -u 1001 -G nodejs

# Copy package files and production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server

# Change ownership to non-root user
RUN chown -R datapilot:nodejs /app

USER datapilot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 http://localhost:3000/api/health/live || exit 1

CMD ["node", "dist/server.cjs"]
