import { validateConnectionInput } from '../server/api/connectionRoutes';
import { DatabaseConnectionParams } from '../src/types/database';

export function runSQLiteConnectionTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: message || 'Assertion failed' });
    }
  }

  // SQLite missing filePath
  const missingPathResult = validateConnectionInput({
    type: 'sqlite'
  });
  assert('missing filePath -> clear validation error', !missingPathResult.isValid && missingPathResult.error === 'SQLite connection requires a filePath.');

  // SQLite empty filePath
  const emptyPathResult = validateConnectionInput({
    type: 'sqlite',
    filePath: '   '
  });
  assert('empty filePath -> clear validation error', !emptyPathResult.isValid && emptyPathResult.error === 'SQLite connection requires a filePath.');

  // SQLite valid relative filePath
  const relPathResult = validateConnectionInput({
    type: 'sqlite',
    filePath: 'data/datapilot_demo.sqlite'
  });
  assert('relative path', relPathResult.isValid && relPathResult.params?.filePath === 'data/datapilot_demo.sqlite');

  // SQLite valid Windows absolute filePath
  const winPathResult = validateConnectionInput({
    type: 'sqlite',
    filePath: 'C:\\Users\\amans\\Desktop\\datapilot_demo.sqlite'
  });
  assert('Windows absolute path', winPathResult.isValid && winPathResult.params?.filePath === 'C:\\Users\\amans\\Desktop\\datapilot_demo.sqlite');

  // PostgreSQL regression (missing host)
  const pgMissingResult = validateConnectionInput({
    type: 'postgresql'
  });
  assert('PostgreSQL regression', !pgMissingResult.isValid && pgMissingResult.error === 'Database host is required.');

  // MySQL regression (missing host)
  const mysqlMissingResult = validateConnectionInput({
    type: 'mysql'
  });
  assert('MySQL regression', !mysqlMissingResult.isValid && mysqlMissingResult.error === 'Database host is required.');

  // SQL Server regression (missing host)
  const sqlserverMissingResult = validateConnectionInput({
    type: 'sqlserver'
  });
  assert('SQL Server regression', !sqlserverMissingResult.isValid && sqlserverMissingResult.error === 'Database host is required.');

  // Oracle regression (missing host)
  const oracleMissingResult = validateConnectionInput({
    type: 'oracle'
  });
  assert('Oracle regression', !oracleMissingResult.isValid && oracleMissingResult.error === 'Database host is required.');

  return results;
}
