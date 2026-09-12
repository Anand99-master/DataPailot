const fs = require('fs');
let content = fs.readFileSync('tests/runDatabaseAdapterTests.ts', 'utf8');

content = content.replace(
  "=== 'sqlite'",
  "=== 'SQLite'"
);

content = content.replace(
  "=== 'SELECT * FROM a\\\\nLIMIT 10'",
  "=== 'SELECT * FROM a\\nLIMIT 10'"
);

fs.writeFileSync('tests/runDatabaseAdapterTests.ts', content);
