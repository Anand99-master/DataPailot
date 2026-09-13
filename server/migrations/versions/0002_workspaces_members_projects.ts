import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types';

export const migration0002: Migration = {
  id: '0002',
  name: 'workspaces_members_projects',
  up: (db: DatabaseSync) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS workspace_members (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ANALYST',
        status TEXT NOT NULL DEFAULT 'active',
        invited_at TEXT NOT NULL,
        joined_at TEXT,
        UNIQUE(workspace_id, user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_members_workspace ON workspace_members(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_members_user ON workspace_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
    `);
  },
  down: (db: DatabaseSync) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_projects_workspace;
      DROP INDEX IF EXISTS idx_members_user;
      DROP INDEX IF EXISTS idx_members_workspace;
      DROP TABLE IF EXISTS projects;
      DROP TABLE IF EXISTS workspace_members;
      DROP TABLE IF EXISTS workspaces;
    `);
  }
};
