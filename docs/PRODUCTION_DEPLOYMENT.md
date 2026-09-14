# DataPilot Production Deployment Guide

This guide outlines best practices and architectural instructions for deploying DataPilot to production environments (Cloud Run, Kubernetes, AWS ECS, or standalone Linux VMs).

---

## 1. Production Prerequisites

- **Runtime**: Node.js 22+ LTS or Docker container runtime.
- **Database**: PostgreSQL 14+ (recommended for multi-tenant production) or SQLite (for single-node / embedded use).
- **Reverse Proxy**: Nginx or cloud load balancer terminating TLS and proxying requests to port `3000`.

---

## 2. Environment Variables

Configure the following environment variables in your production secret manager (do not commit secrets to code):

| Variable | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | Yes | Set to `production` | `production` |
| `PORT` | Yes | Hardcoded ingress port (3000) | `3000` |
| `DATABASE_URL` | For Postgres | Connection string for PostgreSQL | `postgresql://user:pass@localhost:5432/datapilot` |
| `SESSION_SECRET` | Yes | High-entropy secret for session signing | `super-secret-crypto-key-change-me` |
| `GEMINI_API_KEY` | Optional | Server-side Gemini API key for AI features | `AIzaSy...` |

---

## 3. Database Migrations

DataPilot includes an automated atomic migration runner. Before starting the production server, run pending migrations:

```bash
# Run database migrations
npm run migrate:up
```

---

## 4. Docker Deployment

DataPilot includes a multi-stage `Dockerfile` and `docker-compose.yml`.

### Build & Run via Docker Compose

1. Copy `.env.docker.example` to `.env` and fill in production secrets.
2. Build and launch containers:
   ```bash
   docker compose up --build -d
   ```

---

## 5. Health & Readiness Endpoints

DataPilot exposes standard Kubernetes-compatible probe endpoints:
- **Liveness Probe**: `GET /api/health` -> Returns `{ status: 'ok', uptime, timestamp }`.
- **Readiness Probe**: `GET /api/health/ready` -> Verifies database connectivity and migration status.

---

## 6. Backups & Recovery

- **PostgreSQL Backups**: Schedule daily `pg_dump` jobs encrypted at rest:
  ```bash
  pg_dump -U datapilot -d datapilot_prod | gzip > /backups/datapilot_$(date +%F).sql.gz
  ```
- **SQLite Backups**: Use online vacuum backup:
  ```bash
  sqlite3 data/datapilot.sqlite ".backup 'data/backup_$(date +%F).sqlite'"
  ```

---

## 7. Security Hardening

- **HTTPS Only**: Enforce TLS 1.3 with secure HSTS headers.
- **SQL Sanitization**: All incoming queries pass through the server-side `QuerySafetyValidator` to neutralize DDL/DML injections.
- **Export Guard**: Excel and CSV exports include formula injection neutralization (`=` or `+` prefixes are safely escaped).
