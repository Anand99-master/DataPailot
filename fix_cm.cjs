const fs = require('fs');
let content = fs.readFileSync('server/database/ConnectionManager.ts', 'utf8');

content = content.replace(
  "import { PostgreSQLAdapter } from './PostgreSQLAdapter';",
  "import { DatabaseAdapterFactory } from './DatabaseAdapterFactory';"
);

content = content.replace(
  /public createAdapter\(params: DatabaseConnectionParams\): DatabaseAdapter \{[\s\S]*?^\s*\}/m,
  "public createAdapter(params: DatabaseConnectionParams): DatabaseAdapter {\n    return DatabaseAdapterFactory.create(params);\n  }"
);

fs.writeFileSync('server/database/ConnectionManager.ts', content);
