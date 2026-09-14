# DataPilot Admin & Operator Runbook

This runbook provides operational procedures for system administrators managing DataPilot in production.

---

## 1. Startup & Shutdown

- **Graceful Startup**:
  ```bash
  NODE_ENV=production node dist/server.cjs
  ```
- **Graceful Shutdown**: Send `SIGTERM`. The server drains active connections and closes database pools cleanly.

---

## 2. Health & Monitoring

- **Check Liveness**:
  ```bash
  curl -i http://localhost:3000/api/health
  ```
- **Check Readiness**:
  ```bash
  curl -i http://localhost:3000/api/health/ready
  ```
- **Logs**: DataPilot emits structured JSON logs with correlation IDs (`reqId`). Inspect logs via Docker or journald.

---

## 3. Database Migration & Rollback

- **Apply Pending Migrations**:
  ```bash
  npm run migrate:up
  ```
- **Rollback Latest Migration**:
  ```bash
  npm run migrate:down
  ```
- **Check Migration Status**:
  ```bash
  npm run migrate:status
  ```

---

## 4. Troubleshooting

- **Database Connection Failure**: Verify `DATABASE_URL` format and network connectivity to PostgreSQL.
- **Port Ingress Error**: Ensure ingress is routing traffic to port `3000`.
- **Memory Pressure**: For large dataset imports (>50k rows), verify Node heap size is appropriately allocated (`--max-old-space-size=4096`).

---

## 5. Secret Rotation Procedure

1. Generate new secret values for `SESSION_SECRET` or `GEMINI_API_KEY`.
2. Update the secret manager / environment store.
3. Perform a rolling restart of the DataPilot container cluster.
