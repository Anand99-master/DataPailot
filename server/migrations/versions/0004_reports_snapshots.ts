import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types';

export const migration0004: Migration = {
  id: '0004',
  name: 'reports_snapshots',
  up: (db: DatabaseSync) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        dashboard_id TEXT,
        config_json TEXT NOT NULL,
        kpis_json TEXT NOT NULL,
        insights_json TEXT NOT NULL,
        filters_json TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'published',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS report_snapshots (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        snapshot_title TEXT NOT NULL,
        config_json TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        filters_json TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_reports_workspace ON reports(workspace_id);
    `);
  },
  down: (db: DatabaseSync) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_reports_workspace;
      DROP TABLE IF EXISTS report_snapshots;
      DROP TABLE IF EXISTS reports;
    `);
  }
};
