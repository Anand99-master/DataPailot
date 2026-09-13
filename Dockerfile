# ==============================================================================
# DATAPILOT PRODUCTION DOCKERFILE
# Multi-stage build for secure, optimized production deployment
# ==============================================================================

# Stage 1: Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies if needed (python, make, g++ for native modules)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for building frontend/backend)
RUN npm ci --legacy-peer-deps

# Copy source files
COPY . .

# Build frontend and backend bundle
RUN npm run build

# Stage 2: Production Runner Stage
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install production runtime dependencies, curl, and build tools for native modules (sqlite3, oracledb, mssql)
RUN apk add --no-cache curl python3 make g++ build-base

# Copy package files and install production dependencies only
COPY package.json package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
RUN npm cache clean --force

# Remove build tools to keep final image slim and secure
RUN apk del python3 make g++ build-base

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/src ./src

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create data directory for local sqlite fallback with correct permissions
RUN mkdir -p /app/data && chown -R node:node /app/data /app/dist /app/server /app/src /app/index.html /app/server.ts /app/docker-entrypoint.sh

# Switch to non-root user
USER node

# Expose HTTP port
EXPOSE 3000

# Health check using readiness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health/ready || exit 1

# Start via entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
