const fs = require('fs');
let content = fs.readFileSync('tests/runAllTests.ts', 'utf8');

content = content.replace(
  "import { runDatabaseAdapterTests } from './testDatabaseAdapter';",
  "import { runDatabaseAdapterTests } from './testDatabaseAdapter';\nimport { runDatabaseAdapterTests as runAdapterFoundationTests } from './runDatabaseAdapterTests';"
);

content = content.replace(
  "{ name: '0. SQL AUTOCOMPLETE', runner: runSqlAutocompleteTests },",
  "{ name: '0. SQL AUTOCOMPLETE', runner: runSqlAutocompleteTests },\n  { name: '5. DATABASE ADAPTER FOUNDATION', runner: runAdapterFoundationTests as any },"
);

fs.writeFileSync('tests/runAllTests.ts', content);
