# DataPilot Deployment & Infrastructure Guide

## 1. Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Docker & Docker Compose (for containerized deployments)

## 2. Environment Variables
Configure production environment variables in `.env` (refer to `.env.example`):
- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL=postgresql://user:password@host:5432/dbname`
- `SESSION_SECRET=your-secure-secret-key`

## 3. Database Setup & Migrations
DataPilot uses structured migrations with version tracking.
To run migrations against PostgreSQL:
```bash
npm run build
```
Migrations run automatically on startup or via test suites.

## 4. Build & Start
```bash
npm ci
npm run build
npm start
```

## 5. Docker Deployment
Build and run using Docker Compose:
```bash
docker-compose up -d --build
```

## 6. Health & Readiness Checks
- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`
- Diagnostics: `GET /api/health`

## 7. Monitoring & Rollback
- Logs are output in structured JSON format with request correlation IDs (`X-Request-ID`).
- Rollback: Revert to previous Docker image tag and run forward-compatible database migrations.
