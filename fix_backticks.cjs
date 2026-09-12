const fs = require('fs');
let content = fs.readFileSync('server/database/SQLiteAdapter.ts', 'utf8');

// The file has things like \` instead of `
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');

fs.writeFileSync('server/database/SQLiteAdapter.ts', content);
