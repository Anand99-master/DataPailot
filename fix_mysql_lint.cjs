const fs = require('fs');

// Fix MySQLAdapter
let mysqlAdapter = fs.readFileSync('server/database/MySQLAdapter.ts', 'utf8');
mysqlAdapter = mysqlAdapter.replace(
  "private readonly config: DatabaseConnectionParams;",
  ""
);
fs.writeFileSync('server/database/MySQLAdapter.ts', mysqlAdapter);

// Fix tests
let tests = fs.readFileSync('tests/runDatabaseAdapterTests.ts', 'utf8');
tests = tests.replace(
  "const mysqlParams = { type: 'mysql', host: 'localhost', database: 'test', username: 'root' };",
  "const mysqlParams: DatabaseConnectionParams = { type: 'mysql', host: 'localhost', database: 'test', username: 'root' };"
);
fs.writeFileSync('tests/runDatabaseAdapterTests.ts', tests);
