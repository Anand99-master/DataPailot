# DataPilot Production Deployment & Docker Guide

## 1. Local Development
To run DataPilot in development mode:
```bash
npm install
npm run dev
```
Access the application at `http://localhost:3000`.

## 2. Docker Build
To build the production Docker image manually:
```bash
docker build -t datapilot:latest .
```

## 3. Docker Compose Startup
For production-like local testing with PostgreSQL and DataPilot:
1. Copy `.env.docker.example` to `.env.docker`:
   ```bash
   cp .env.docker.example .env.docker
   ```
2. Start the stack:
   ```bash
   docker compose --env-file .env.docker up --build
   ```

## 4. Environment Variables
- `NODE_ENV`: Set to `production` in containerized environments.
- `DATABASE_URL`: Connection string for PostgreSQL (e.g. `postgresql://user:pass@host:5432/dbname`).
- `SESSION_SECRET`: Cryptographically secure secret for session management.
- `GEMINI_API_KEY`: Optional Gemini AI API key for AI assistant and smart cleaning features.

## 5. PostgreSQL Persistence
PostgreSQL state is persisted using a named Docker volume (`postgres_data`), ensuring database data survives container restarts and upgrades.

## 6. Migration Workflow
DataPilot features an ordered migration system (Phase 16.4A):
- Validate migrations: `npm run migrate:validate`
- Apply migrations: `npm run migrate:up`
- Check status: `npm run migrate:status`
- Rollback: `npm run migrate:down`

In Docker, the container entrypoint (`docker-entrypoint.sh`) automatically validates and applies pending migrations prior to starting the production server.

## 7. Health Endpoints
- `GET /api/health/live`: Liveness check confirming process responsiveness.
- `GET /api/health/ready`: Readiness check verifying database and service connectivity.
- `GET /api/health`: Comprehensive system diagnostics, memory usage, and AI configuration status.

## 8. Graceful Shutdown
The application handles `SIGTERM` and `SIGINT` signals gracefully:
1. Stops accepting new HTTP requests.
2. Drains in-flight requests.
3. Closes active database pools and connections.
4. Exits cleanly (with a 10s forced timeout fallback).

## 9. Logs
All application logs are structured JSON output streamed directly to `stdout` and `stderr` for collection by container orchestrators.

## 10. Backup Considerations
Before performing major migrations or upgrades in production:
- Take a consistent snapshot or `pg_dump` of PostgreSQL.
- Verify backup integrity.

## 11. Production Deployment Notes
- Always use non-root container users (configured as `node` in Dockerfile).
- Never bake secrets into Docker images or commit `.env` files.
- Use secret managers (Kubernetes secrets, Cloud Run secret manager) in production environments.
