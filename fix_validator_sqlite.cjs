const fs = require('fs');
let content = fs.readFileSync('server/database/QuerySafetyValidator.ts', 'utf8');

// Fix EXPLAIN QUERY PLAN
content = content.replace(
  "if (!['SELECT', 'WITH'].includes(innerKeyword)) {",
  "if (!['SELECT', 'WITH', 'QUERY'].includes(innerKeyword)) {"
);

fs.writeFileSync('server/database/QuerySafetyValidator.ts', content);

let tests = fs.readFileSync('tests/runDatabaseAdapterTests.ts', 'utf8');
tests = tests.replace(
  /if \(e\.message\.includes\('Blocked'\)\) blocked = true;/g,
  "if (e.message.toLowerCase().includes('blocked')) blocked = true;"
);
tests = tests.replace(
  /if \(e\.message\.includes\('Blocked'\)\) pragmaBlocked = true;/g,
  "if (e.message.toLowerCase().includes('blocked')) pragmaBlocked = true;"
);
fs.writeFileSync('tests/runDatabaseAdapterTests.ts', tests);
