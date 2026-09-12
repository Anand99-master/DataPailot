import { ConnectionManager } from '../server/database/ConnectionManager';
import { ApiValidation } from '../server/utils/apiValidation';
import { PostgreSQLAdapter } from '../server/database/PostgreSQLAdapter';

export function runDatabaseAdapterTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: message || 'Assertion failed' });
    }
  }

  // 1. ConnectionManager singleton pattern
  const cm1 = ConnectionManager.getInstance();
  const cm2 = ConnectionManager.getInstance();
  assert('DB-1: ConnectionManager is a singleton', cm1 === cm2);

  // 2. Session isolation: non-existent session returns null
  const randomSession = 'sess_nonexistent_' + Date.now();
  const adapter = cm1.getAdapter(randomSession);
  assert('DB-2: Session isolation - empty session returns null adapter', adapter === null);

  const info = cm1.getConnectionInfo(randomSession);
  assert('DB-3: Session isolation - empty session returns null connection info', info === null);

  // 3. Identifier validation
  const validIdent = ApiValidation.validateIdentifier('public', 'Schema');
  assert('IDENT-1: Valid identifier passes', validIdent.isValid && validIdent.cleanName === 'public');

  const invalidIdentSpace = ApiValidation.validateIdentifier('table; DROP TABLE users', 'Table');
  assert('IDENT-2: Dangerous identifier with semicolon rejected', !invalidIdentSpace.isValid);

  const emptyIdent = ApiValidation.validateIdentifier('   ', 'Table');
  assert('IDENT-3: Empty identifier rejected', !emptyIdent.isValid);

  // 4. PostgreSQL adapter configuration
  const testAdapter = new PostgreSQLAdapter({
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'testdb',
    username: 'testuser',
    password: 'password123',
    ssl: false
  });

  assert('DB-4: PostgreSQL adapter initialized with postgresql type', testAdapter.type === 'postgresql');
  assert('DB-5: Adapter initial status is disconnected', !testAdapter.isConnected());

  return results;
}
