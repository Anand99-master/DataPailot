const fs = require('fs');
let content = fs.readFileSync('src/types/database.ts', 'utf8');

content = content.replace(
  "type: 'postgresql' | 'mysql' | 'sqlserver';",
  "type: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';\n  filePath?: string;"
);

content = content.replace(
  "host: string;\n  port: number;\n  database: string;\n  username: string;",
  "host?: string;\n  port?: number;\n  database?: string;\n  username?: string;"
);

fs.writeFileSync('src/types/database.ts', content);
