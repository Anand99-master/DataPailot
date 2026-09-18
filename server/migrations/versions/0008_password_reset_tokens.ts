import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types';

export const migration0008: Migration = {
  id: '0008',
  name: 'password_reset_tokens',
  up: (db: DatabaseSync) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        used_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_reset_user_id ON password_reset_tokens(user_id);
    `);
  },
  down: (db: DatabaseSync) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_reset_token_hash;
      DROP INDEX IF EXISTS idx_reset_user_id;
      DROP TABLE IF EXISTS password_reset_tokens;
    `);
  }
};
