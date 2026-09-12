const fs = require('fs');
let content = fs.readFileSync('src/types/database.ts', 'utf8');
content = content.replace(
  "isRunning: boolean;\n}",
  "isRunning: boolean;\n  savedQueryId?: string;\n  isModified?: boolean;\n}"
);
fs.writeFileSync('src/types/database.ts', content);
