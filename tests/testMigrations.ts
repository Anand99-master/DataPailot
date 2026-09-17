import { DatabaseSync } from 'node:sqlite';
import { MigrationRunner } from '../server/migrations/MigrationRunner';
import fs from 'fs';
import path from 'path';

export async function runMigrationTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const testDbPath = path.join(process.cwd(), 'data', 'test_migrations_' + Date.now() + '.sqlite');

  try {
    // Ensure data dir
    if (!fs.existsSync(path.dirname(testDbPath))) {
      fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
    }

    const db = new DatabaseSync(testDbPath);
    const runner = new MigrationRunner(db);

    // Test 1: Status check on fresh database
    const initialStatus = runner.status();
    results.push({
      name: '16.4A.1: Migration status discovery on fresh database',
      passed: initialStatus.length === 7 && initialStatus.every(s => !s.applied)
    });

    // Test 2: Validation on fresh database
    const validation1 = runner.validate();
    results.push({
      name: '16.4A.2: Migration validation on fresh database',
      passed: validation1.valid
    });

    // Test 3: Apply migrations (up)
    const applyResult = runner.up();
    results.push({
      name: '16.4A.3: Apply pending migrations (up)',
      passed: applyResult.appliedCount === 7
    });

    // Test 4: Post-apply status check
    const postStatus = runner.status();
    results.push({
      name: '16.4A.4: Status shows all migrations applied',
      passed: postStatus.every(s => s.applied && Boolean(s.appliedAt) && Boolean(s.checksum))
    });

    // Test 5: Rollback latest migration (down)
    const rollbackResult = runner.down();
    results.push({
      name: '16.4A.5: Rollback latest migration (down)',
      passed: rollbackResult.rolledBack === '0007'
    });

    // Test 6: Re-apply rolled back migration
    const reapplyResult = runner.up();
    results.push({
      name: '16.4A.6: Re-apply pending migration successfully',
      passed: reapplyResult.appliedCount === 1
    });

    // Test 7: Existing schema bootstrap simulation
    const bootstrapDbPath = path.join(process.cwd(), 'data', 'test_bootstrap_' + Date.now() + '.sqlite');
    const bootstrapDb = new DatabaseSync(bootstrapDbPath);
    // Create legacy table manually without schema_migrations
    bootstrapDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO users (id, name, email, password_hash, salt, created_at, updated_at)
      VALUES ('usr_legacy', 'Legacy User', 'legacy@example.com', 'hash', 'salt', '2026-01-01', '2026-01-01');
    `);

    const bootstrapRunner = new MigrationRunner(bootstrapDb);
    bootstrapRunner.baselineExistingSchemaIfNeeded();
    const bootstrapStatus = bootstrapRunner.status();
    const userCount = bootstrapDb.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };

    results.push({
      name: '16.4A.7: Existing schema baseline bootstrap preserves data and marks migrations applied',
      passed: bootstrapStatus.every(s => s.applied) && userCount.cnt === 1
    });

    // Cleanup test dbs
    try {
      db.close();
      bootstrapDb.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(bootstrapDbPath)) fs.unlinkSync(bootstrapDbPath);
    } catch {}

  } catch (err: any) {
    results.push({
      name: 'Migration Test Suite Execution',
      passed: false,
      error: err.message
    });
  }

  return results;
}
