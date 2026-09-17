import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types';

export const migration0007: Migration = {
  id: '0007',
  name: 'auth_foundation_indexes',
  up: (db: DatabaseSync) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `);
  },
  down: (db: DatabaseSync) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_users_email;
      DROP INDEX IF EXISTS idx_sessions_user_id;
    `);
  }
};
