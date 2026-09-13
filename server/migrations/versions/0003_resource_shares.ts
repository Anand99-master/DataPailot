import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types';

export const migration0003: Migration = {
  id: '0003',
  name: 'resource_shares',
  up: (db: DatabaseSync) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS resource_shares (
        id TEXT PRIMARY KEY,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        shared_with_user_id TEXT NOT NULL,
        access_level TEXT NOT NULL DEFAULT 'viewer',
        shared_by_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(resource_type, resource_id, shared_with_user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_shares_resource ON resource_shares(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_shares_user ON resource_shares(shared_with_user_id);
    `);
  },
  down: (db: DatabaseSync) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_shares_user;
      DROP INDEX IF EXISTS idx_shares_resource;
      DROP TABLE IF EXISTS resource_shares;
    `);
  }
};
