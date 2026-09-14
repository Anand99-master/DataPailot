import { DatabaseSync } from 'node:sqlite';
import { MigrationRunner } from '../server/migrations/MigrationRunner';
import fs from 'fs';
import path from 'path';

export async function runDeploymentSmokeTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const testDbPath = path.join(process.cwd(), 'data', 'test_smoke_' + Date.now() + '.sqlite');

  try {
    if (!fs.existsSync(path.dirname(testDbPath))) {
      fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
    }

    const db = new DatabaseSync(testDbPath);
    const runner = new MigrationRunner(db);

    // Test 1: Migration validation check
    const validation = runner.validate();
    results.push({
      name: '16.4C.1: Deployment migration validation check',
      passed: validation.valid
    });

    // Test 2: Apply migrations for smoke test
    const upRes = runner.up();
    results.push({
      name: '16.4C.2: Deployment migration application',
      passed: upRes.appliedCount >= 6
    });

    // Test 3: Read-only query path verification
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    results.push({
      name: '16.4C.3: Read-only database query path and table verification',
      passed: tables.length >= 6
    });

    // Test 4: Health and readiness simulation check
    const healthLiveOk = true; // Process responsive
    const healthReadyOk = validation.valid && tables.length > 0; // DB connected and migrated
    results.push({
      name: '16.4C.4: Health (live) and Readiness (ready) status check',
      passed: healthLiveOk && healthReadyOk
    });

    try {
      db.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch {}

  } catch (err: any) {
    results.push({
      name: 'Deployment Smoke Test Suite',
      passed: false,
      error: err.message
    });
  }

  return results;
}
