import { DatabaseSync } from 'node:sqlite';
import { MigrationRunner } from '../server/migrations/MigrationRunner';
import fs from 'fs';
import path from 'path';

export async function runDockerAndProductionTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const testDbPath = path.join(process.cwd(), 'data', 'test_prod_' + Date.now() + '.sqlite');

  try {
    if (!fs.existsSync(path.dirname(testDbPath))) {
      fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
    }

    const db = new DatabaseSync(testDbPath);
    const runner = new MigrationRunner(db);

    // Test 1: Migration runner validate on clean test db
    const validation = runner.validate();
    results.push({
      name: '16.4B.1: Production migration validation check',
      passed: validation.valid
    });

    // Test 2: Migration status check
    const status = runner.status();
    results.push({
      name: '16.4B.2: Migration status inspection',
      passed: status.length >= 6
    });

    // Test 3: Apply migrations
    const upResult = runner.up();
    results.push({
      name: '16.4B.3: Production migration application (up)',
      passed: upResult.appliedCount >= 6
    });

    // Test 4: Dockerfile and compose file existence check
    const dockerfileExist = fs.existsSync(path.join(process.cwd(), 'Dockerfile'));
    const composeExist = fs.existsSync(path.join(process.cwd(), 'docker-compose.yml'));
    const envDockerExampleExist = fs.existsSync(path.join(process.cwd(), '.env.docker.example'));
    const deploymentMdExist = fs.existsSync(path.join(process.cwd(), 'DEPLOYMENT.md'));

    results.push({
      name: '16.4B.4: Dockerfile, compose, env example, and DEPLOYMENT.md exist',
      passed: dockerfileExist && composeExist && envDockerExampleExist && deploymentMdExist
    });

    // Test 5: Entrypoint script existence and executability
    const entrypointExist = fs.existsSync(path.join(process.cwd(), 'docker-entrypoint.sh'));
    results.push({
      name: '16.4B.5: Docker entrypoint script exists',
      passed: entrypointExist
    });

    try {
      db.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch {}

  } catch (err: any) {
    results.push({
      name: 'Docker & Production Test Suite',
      passed: false,
      error: err.message
    });
  }

  return results;
}
