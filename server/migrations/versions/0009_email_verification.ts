import { DatabaseSync } from 'node:sqlite';
import { Migration } from '../types';

export const migration0009: Migration = {
  id: '0009',
  name: 'email_verification',
  up: (db: DatabaseSync) => {
    // Add email verification columns to users table
    try {
      db.exec(`ALTER TABLE users ADD COLUMN email_verified_at TEXT;`);
    } catch {
      // Column already exists
    }
    try {
      db.exec(`ALTER TABLE users ADD COLUMN email_verification_token_hash TEXT;`);
    } catch {
      // Column already exists
    }
    try {
      db.exec(`ALTER TABLE users ADD COLUMN email_verification_expires_at TEXT;`);
    } catch {
      // Column already exists
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash 
      ON users(email_verification_token_hash);
    `);
  },
  down: (db: DatabaseSync) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_users_email_verification_token_hash;
    `);
  }
};
