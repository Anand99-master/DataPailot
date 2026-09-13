import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { MigrationRunner } from './MigrationRunner';

function getDatabase(): DatabaseSync {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'datapilot_collaboration.sqlite');
  return new DatabaseSync(dbPath);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  const db = getDatabase();
  const runner = new MigrationRunner(db);

  try {
    if (command === 'status') {
      console.log('\nDataPilot Migration Status\n');
      const statuses = runner.status();
      for (const s of statuses) {
        const icon = s.applied ? '✓' : '○';
        const label = s.applied ? 'applied' : 'pending';
        console.log(`${icon} ${s.id} ${s.name} (${label})`);
      }
      console.log('');
    } else if (command === 'validate') {
      console.log('\nValidating DataPilot Migrations...\n');
      const validation = runner.validate();
      if (validation.valid) {
        console.log('✓ All migration files and schema versions are valid.\n');
        process.exit(0);
      } else {
        console.error('✗ Migration validation failed:');
        for (const err of validation.errors) {
          console.error(`  - ${err}`);
        }
        console.log('');
        process.exit(1);
      }
    } else if (command === 'up') {
      console.log('\nDataPilot Database Migrations - Applying Pending Migrations\n');
      const result = runner.up();
      for (const msg of result.messages) {
        console.log(msg);
      }
      console.log(`\nMigration complete. Applied ${result.appliedCount} migration(s).\n`);
    } else if (command === 'down') {
      console.log('\nDataPilot Database Migrations - Rolling Back Latest Migration\n');
      const result = runner.down();
      console.log(result.message);
      console.log('');
    } else {
      console.error(`Unknown migration command: ${command}`);
      console.error('Usage: tsx server/migrations/cli.ts [status|validate|up|down]');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\n✗ Migration execution error:', err.message || err);
    process.exit(1);
  }
}

main();
