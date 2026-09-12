import { QuerySafetyValidator } from '../server/database/QuerySafetyValidator';
import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';

export function runSqlSecurityTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: message || 'Assertion failed' });
    }
  }

  // 1. SELECT * FROM users; -> ALLOW
  const r1 = QuerySafetyValidator.validate('SELECT * FROM users;');
  assert('RTM-1: SELECT * FROM users -> ALLOW', r1.isValid && r1.statementType === 'SELECT', r1.error);

  // 2. DROP TABLE users; -> BLOCK
  const r2 = QuerySafetyValidator.validate('DROP TABLE users;');
  assert('RTM-2: DROP TABLE users -> BLOCK', !r2.isValid, 'Expected DROP TABLE to be blocked');

  // 3. DELETE FROM users; -> BLOCK
  const r3 = QuerySafetyValidator.validate('DELETE FROM users;');
  assert('RTM-3: DELETE FROM users -> BLOCK', !r3.isValid, 'Expected DELETE to be blocked');

  // 4. UPDATE users SET role = "admin"; -> BLOCK
  const r4 = QuerySafetyValidator.validate("UPDATE users SET role = 'admin';");
  assert('RTM-4: UPDATE users SET role -> BLOCK', !r4.isValid, 'Expected UPDATE to be blocked');

  // 5. SELECT *; DROP TABLE users; -> BLOCK (multi-statement)
  const r5 = QuerySafetyValidator.validate('SELECT 1; DROP TABLE users;');
  assert('RTM-5: SELECT *; DROP TABLE users -> BLOCK', !r5.isValid, 'Expected stacked query to be blocked');

  // 6. SELECT * FROM users WHERE 1=1; -- -> ALLOW (read-only query with comment stripped/inspected)
  const r6 = QuerySafetyValidator.validate('SELECT * FROM users WHERE 1=1; -- ignore this comment');
  assert('RTM-6: SELECT with trailing comment -> ALLOW', r6.isValid, r6.error);

  // 7. EXPLAIN SELECT * FROM users; -> ALLOW
  const r7 = QuerySafetyValidator.validate('EXPLAIN SELECT * FROM users;');
  assert('RTM-7: EXPLAIN SELECT * FROM users -> ALLOW', r7.isValid && r7.statementType === 'EXPLAIN', r7.error);

  // 8. EXPLAIN ANALYZE SELECT * FROM users; -> BLOCK (destructive due to side-effects)
  const r8 = QuerySafetyValidator.validate('EXPLAIN ANALYZE SELECT * FROM users;');
  assert('RTM-8: EXPLAIN ANALYZE SELECT * -> BLOCK', !r8.isValid, 'Expected EXPLAIN ANALYZE to be blocked');

  // 9. SELECT pg_sleep(10); -> BLOCK / timeout detection
  const r9 = QuerySafetyValidator.validate('SELECT pg_sleep(10);');
  assert('RTM-9: SELECT pg_sleep(10) -> BLOCK', !r9.isValid, 'Expected pg_sleep to be blocked');

  // 10. Table with spaces in name -> QUOTED
  const quotedTable = new AnalysisSqlGenerator(({ quoteIdentifier: (id: string) => `"${id}"`, formatLimit: (sql: string, limit: number) => `${sql} LIMIT ${limit}`, formatPagination: (sql: string, limit: number, offset: number) => `${sql} LIMIT ${limit} OFFSET ${offset}`, formatDate: (date: Date) => `'${date.toISOString()}'`, formatExplain: (sql: string) => `EXPLAIN ${sql}`, qualifyTable: (schema: string | undefined, table: string) => schema ? `"${schema}"."${table}"` : `"${table}"` })).quoteIdentifier('user orders 2024');
  assert('RTM-10: Table with spaces in name is quoted safely', quotedTable === '"user orders 2024"');

  // 11. Column matching reserved keyword -> QUOTED
  const quotedCol = new AnalysisSqlGenerator(({ quoteIdentifier: (id: string) => `"${id}"`, formatLimit: (sql: string, limit: number) => `${sql} LIMIT ${limit}`, formatPagination: (sql: string, limit: number, offset: number) => `${sql} LIMIT ${limit} OFFSET ${offset}`, formatDate: (date: Date) => `'${date.toISOString()}'`, formatExplain: (sql: string) => `EXPLAIN ${sql}`, qualifyTable: (schema: string | undefined, table: string) => schema ? `"${schema}"."${table}"` : `"${table}"` })).quoteIdentifier('select');
  assert('RTM-11: Reserved keyword column is quoted safely', quotedCol === '"select"');

  // Extra Security: Transaction control statements -> BLOCK
  const txBegin = QuerySafetyValidator.validate('BEGIN TRANSACTION;');
  assert('TX-1: BEGIN TRANSACTION -> BLOCK', !txBegin.isValid);
  const txCommit = QuerySafetyValidator.validate('COMMIT;');
  assert('TX-2: COMMIT -> BLOCK', !txCommit.isValid);
  const txRollback = QuerySafetyValidator.validate('ROLLBACK;');
  assert('TX-3: ROLLBACK -> BLOCK', !txRollback.isValid);

  // Extra Security: Multi-statement query splitting detection
  const multiStatements = QuerySafetyValidator.splitStatements('SELECT 1; SELECT 2;');
  assert('MULTI-1: Semicolon splitting detects multiple statements', multiStatements.length === 2);

  // Extra Security: Procedural DO block injection -> BLOCK
  const doBlock = QuerySafetyValidator.validate("DO $$ BEGIN DROP TABLE users; END $$;");
  assert('DOLLAR-1: Procedural DO block with dollar quotes is blocked', !doBlock.isValid);

  // Extra Security: Null-byte injection block
  const nullByte = QuerySafetyValidator.validate("SELECT * FROM users\0WHERE 1=1;");
  assert('NULL-1: Null bytes blocked', !nullByte.isValid);

  // Extra Security: System file functions block
  const pgRead = QuerySafetyValidator.validate("SELECT pg_read_file('conf');");
  assert('FILE-1: pg_read_file blocked', !pgRead.isValid);

  return results;
}
