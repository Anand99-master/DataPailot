# DataPilot Database Backup & Recovery Strategy

## 1. Backup Strategy
- Full automated database backups daily via PostgreSQL `pg_dump`.
- Point-in-time recovery (PITR) enabled on production managed database instances (Cloud SQL / RDS).

## 2. Backup Execution
```bash
pg_dump -U datapilot_user -h localhost datapilot_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 3. Restore Procedure
```bash
psql -U datapilot_user -h localhost datapilot_db < backup_file.sql
```

## 4. Retention Policy
- Daily backups retained for 30 days.
- Weekly backups retained for 12 months.
