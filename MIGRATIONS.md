# DataPilot Database Migrations Guide

## 1. Architecture
DataPilot uses an ordered, version-tracked database migration system for the SQLite collaboration database (`data/datapilot_collaboration.sqlite`).
Migrations are located in `server/migrations/versions/` and executed via `MigrationRunner`.

## 2. Migration Commands (NPM Scripts)
- **Check Status**: `npm run migrate:status`
- **Validate Migrations**: `npm run migrate:validate`
- **Apply Pending Migrations**: `npm run migrate:up`
- **Rollback Latest Migration**: `npm run migrate:down`

## 3. Version Tracking & Checksums
- `schema_migrations` table records applied version, migration name, SHA-256 checksum, and application timestamp.
- Historical migrations are immutable; modifications to applied migration files will fail validation.

## 4. Concurrency & Transactions
- Migrations run inside exclusive database transactions with concurrency protection (`BEGIN EXCLUSIVE TRANSACTION`).
- Failed migrations automatically roll back without partial state changes.

## 5. Existing Database Bootstrap
- If an existing database created by `CollaborationStore` is detected without migration history, the runner automatically baselines existing tables without resetting or destroying data.

## 6. Production Procedure
1. Take a verified backup (`pg_dump` or SQLite file copy).
2. Run `npm run migrate:validate`.
3. Run `npm run migrate:up`.
4. Verify readiness via `/api/health/ready`.
