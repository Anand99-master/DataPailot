import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types';

export const migration0005: Migration = {
  id: '0005',
  name: 'notifications_activities_audit',
  up: (db: DatabaseSync) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        metadata_json TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        resource_name TEXT,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        timestamp TEXT NOT NULL,
        metadata_json TEXT,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        result TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        correlation_id TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read);
      CREATE INDEX IF NOT EXISTS idx_activities_workspace ON activities(workspace_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id, timestamp);
    `);
  },
  down: (db: DatabaseSync) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_audit_workspace;
      DROP INDEX IF EXISTS idx_activities_workspace;
      DROP INDEX IF EXISTS idx_notifications_user_unread;
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS activities;
      DROP TABLE IF EXISTS notifications;
    `);
  }
};
