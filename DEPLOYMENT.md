# DataPilot Production Deployment, CI/CD & Docker Guide

## 1. Local Development
To run DataPilot in development mode:
```bash
npm install
npm run dev
```
Access the application at `http://localhost:3000`.

## 2. CI/CD Pipeline (Phase 16.4C)
DataPilot uses GitHub Actions for continuous integration, Docker validation, staging deployments, and protected production releases.

### Workflows:
- **CI Pipeline (`.github/workflows/ci.yml`)**: Triggered on push/PR to `main`, `master`, or `staging`. Runs `npm ci`, migration validation (`npm run migrate:validate`), TypeScript type check and lint (`npm run lint`), the comprehensive automated test suite against an isolated PostgreSQL service container (`npm test`), and the production build (`npm run build`).
- **Docker CI (`.github/workflows/docker.yml`)**: Builds the multi-stage production Docker image using BuildKit/buildx, verifies container startup, and checks readiness/health endpoints.
- **Staging Deployment (`.github/workflows/staging.yml`)**: Triggered on push to `staging` or manual `workflow_dispatch`. Runs tests, migration validation, builds Docker image, and applies migrations against the staging database.
- **Production Deployment (`.github/workflows/production.yml`)**: Triggered via manual `workflow_dispatch` with required release tag. Protected by GitHub Environments (`production`), concurrency control, rigorous validation, immutable image tagging (`datapilot:prod-<tag>-<sha>`), and safe migration execution.

## 3. Docker Build & Compose
To build the production Docker image manually:
```bash
docker build -t datapilot:latest .
```

For production-like local testing with PostgreSQL and DataPilot:
1. Copy `.env.docker.example` to `.env.docker`:
   ```bash
   cp .env.docker.example .env.docker
   ```
2. Start the stack:
   ```bash
   docker compose --env-file .env.docker up --build
   ```

## 4. Environment Variables & Secrets Management
- Never commit `.env` files or hardcode secrets.
- Use GitHub Actions Secrets for `DATABASE_URL`, `SESSION_SECRET`, and `GEMINI_API_KEY`.
- Mandatory variables: `NODE_ENV=production`, `PORT=3000`, `DATABASE_URL`, `SESSION_SECRET`.

## 5. PostgreSQL Persistence
PostgreSQL state is persisted using a named Docker volume (`postgres_data`), ensuring database data survives container restarts and upgrades.

## 6. Migration Workflow & Safety (Phase 16.4A)
DataPilot features an ordered migration system:
- Validate migrations: `npm run migrate:validate`
- Apply migrations: `npm run migrate:up`
- Check status: `npm run migrate:status`
- Rollback: `npm run migrate:down`

In Docker, the container entrypoint (`docker-entrypoint.sh`) automatically validates and applies pending migrations prior to starting the production server.
- **Production Safety**: Never run destructive migration-down in production. Prefer forward-compatible migrations.

## 7. Health Endpoints & Smoke Tests
- `GET /api/health/live`: Liveness check confirming process responsiveness.
- `GET /api/health/ready`: Readiness check verifying database and service connectivity.
- `GET /api/health`: Comprehensive system diagnostics, memory usage, and AI configuration status.
- **Smoke Tests**: Post-deployment smoke tests verify server responsiveness, health endpoints, read-only query paths, and migration status.

## 8. Graceful Shutdown & Rollback Strategy
- **Graceful Shutdown**: Stops accepting new requests, drains in-flight requests, closes active database pools, and exits cleanly within a 10s fallback timeout.
- **Rollback**: Revert to the previous known-good immutable Docker image tag. Database rollbacks are manual and restricted to explicitly reversible migrations when necessary.

## 9. Troubleshooting & Backup
- **Backup**: Take a consistent `pg_dump` snapshot prior to major migrations.
- **Logs**: Structured JSON output streamed to `stdout`/`stderr`.
