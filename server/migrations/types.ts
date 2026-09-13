import { DatabaseSync } from 'node:sqlite';

export interface Migration {
  id: string; // e.g. "0001"
  name: string; // e.g. "initial_users_sessions"
  up: (db: DatabaseSync) => void;
  down: (db: DatabaseSync) => void;
}

export interface MigrationStatusEntry {
  id: string;
  name: string;
  applied: boolean;
  appliedAt?: string;
  checksum?: string;
}
