const fs = require('fs');
let content = fs.readFileSync('server/database/ConnectionManager.ts', 'utf8');

content = content.replace(
  "  }\n  }\n  public async testConnection",
  "  }\n\n  public async testConnection"
);

fs.writeFileSync('server/database/ConnectionManager.ts', content);
