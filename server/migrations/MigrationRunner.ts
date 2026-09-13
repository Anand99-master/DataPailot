import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { Migration, MigrationStatusEntry } from './types';
import { migration0001 } from './versions/0001_initial_users_sessions';
import { migration0002 } from './versions/0002_workspaces_members_projects';
import { migration0003 } from './versions/0003_resource_shares';
import { migration0004 } from './versions/0004_reports_snapshots';
import { migration0005 } from './versions/0005_notifications_activities_audit';
import { migration0006 } from './versions/0006_queries_dashboards_pipelines';

export class MigrationRunner {
  private db: DatabaseSync;
  private migrations: Migration[];

  constructor(db: DatabaseSync) {
    this.db = db;
    this.migrations = [
      migration0001,
      migration0002,
      migration0003,
      migration0004,
      migration0005,
      migration0006
    ].sort((a, b) => a.id.localeCompare(b.id));
  }

  private computeChecksum(migration: Migration): string {
    const content = migration.up.toString();
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public ensureMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  public baselineExistingSchemaIfNeeded(): void {
    this.ensureMigrationTable();

    const res = this.db.prepare('SELECT COUNT(*) as count FROM schema_migrations').get() as { count: number };
    if (res && res.count === 0) {
      const tableCheck = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='users'
      `).get();

      if (tableCheck) {
        const now = new Date().toISOString();
        for (const m of this.migrations) {
          const checksum = this.computeChecksum(m);
          this.db.prepare(`
            INSERT OR IGNORE INTO schema_migrations (version, name, checksum, applied_at)
            VALUES (?, ?, ?, ?)
          `).run(m.id, m.name, checksum, now);
        }
      }
    }
  }

  public status(): MigrationStatusEntry[] {
    this.baselineExistingSchemaIfNeeded();
    const appliedRows = this.db.prepare('SELECT version, name, checksum, applied_at FROM schema_migrations').all() as {
      version: string;
      name: string;
      checksum: string;
      applied_at: string;
    }[];

    const appliedMap = new Map(appliedRows.map(r => [r.version, r]));

    return this.migrations.map(m => {
      const applied = appliedMap.has(m.id);
      const row = appliedMap.get(m.id);
      return {
        id: m.id,
        name: m.name,
        applied,
        appliedAt: row?.applied_at,
        checksum: row?.checksum
      };
    });
  }

  public validate(): { valid: boolean; errors: string[] } {
    this.baselineExistingSchemaIfNeeded();
    const errors: string[] = [];
    const appliedRows = this.db.prepare('SELECT version, name, checksum FROM schema_migrations').all() as {
      version: string;
      name: string;
      checksum: string;
    }[];

    const migrationMap = new Map(this.migrations.map(m => [m.id, m]));

    const seenIds = new Set<string>();
    for (const m of this.migrations) {
      if (seenIds.has(m.id)) {
        errors.push(`Duplicate migration version ID found in definitions: ${m.id}`);
      }
      seenIds.add(m.id);
    }

    for (const applied of appliedRows) {
      const def = migrationMap.get(applied.version);
      if (!def) {
        errors.push(`Applied migration ${applied.version} (${applied.name}) has no corresponding migration file.`);
      } else {
        const currentChecksum = this.computeChecksum(def);
        if (applied.checksum && applied.checksum !== currentChecksum) {
          errors.push(`Migration ${applied.version} (${applied.name}) content has been modified since it was applied (checksum mismatch).`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public up(): { appliedCount: number; messages: string[] } {
    this.baselineExistingSchemaIfNeeded();
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Migration validation failed:\n- ${validation.errors.join('\n- ')}`);
    }

    this.db.exec('BEGIN EXCLUSIVE TRANSACTION;');
    const messages: string[] = [];
    let appliedCount = 0;

    try {
      const appliedRows = this.db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[];
      const appliedSet = new Set(appliedRows.map(r => r.version));

      for (const m of this.migrations) {
        if (!appliedSet.has(m.id)) {
          messages.push(`Applying migration ${m.id} ${m.name}...`);
          m.up(this.db);
          const checksum = this.computeChecksum(m);
          const now = new Date().toISOString();
          this.db.prepare(`
            INSERT INTO schema_migrations (version, name, checksum, applied_at)
            VALUES (?, ?, ?, ?)
          `).run(m.id, m.name, checksum, now);
          appliedCount++;
          messages.push(`✓ Applied ${m.id} ${m.name}`);
        }
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return { appliedCount, messages };
  }

  public down(): { rolledBack: string | null; message: string } {
    this.baselineExistingSchemaIfNeeded();
    const appliedRows = this.db.prepare('SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1').all() as {
      version: string;
      name: string;
    }[];

    if (appliedRows.length === 0) {
      return { rolledBack: null, message: 'No applied migrations to rollback.' };
    }

    const latest = appliedRows[0];
    const migrationDef = this.migrations.find(m => m.id === latest.version);

    if (!migrationDef) {
      throw new Error(`Cannot rollback migration ${latest.version}: definition file not found.`);
    }

    this.db.exec('BEGIN EXCLUSIVE TRANSACTION;');
    try {
      migrationDef.down(this.db);
      this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(latest.version);
      this.db.exec('COMMIT;');
      return {
        rolledBack: latest.version,
        message: `✓ Rolled back migration ${latest.version} ${latest.name}`
      };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }
}
