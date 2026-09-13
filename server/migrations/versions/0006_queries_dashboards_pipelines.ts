import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types';

export const migration0006: Migration = {
  id: '0006',
  name: 'queries_dashboards_pipelines',
  up: (db: DatabaseSync) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS saved_queries_store (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        description TEXT,
        tags_json TEXT,
        is_favorite INTEGER DEFAULT 0,
        visibility TEXT DEFAULT 'WORKSPACE',
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        last_executed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dashboards_store (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        widgets_json TEXT NOT NULL,
        filters_json TEXT NOT NULL,
        layout_json TEXT NOT NULL,
        visibility TEXT DEFAULT 'WORKSPACE',
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        auto_refresh_interval INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pipelines_store (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        owner_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        steps_json TEXT NOT NULL,
        visibility TEXT DEFAULT 'WORKSPACE',
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_queries_workspace ON saved_queries_store(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_dashboards_workspace ON dashboards_store(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_pipelines_workspace ON pipelines_store(workspace_id);
    `);
  },
  down: (db: DatabaseSync) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_pipelines_workspace;
      DROP INDEX IF EXISTS idx_dashboards_workspace;
      DROP INDEX IF EXISTS idx_queries_workspace;
      DROP TABLE IF EXISTS pipelines_store;
      DROP TABLE IF EXISTS dashboards_store;
      DROP TABLE IF EXISTS saved_queries_store;
    `);
  }
};
