const fs = require('fs');
let code = fs.readFileSync('server/database/SQLiteAdapter.ts', 'utf8');
code = code.replace("`${sql}\\\\nLIMIT ${limit}`", "`${sql} LIMIT ${limit}`");
code = code.replace("`${sql}\\\\nLIMIT ${limit} OFFSET ${offset}`", "`${sql} LIMIT ${limit} OFFSET ${offset}`");
fs.writeFileSync('server/database/SQLiteAdapter.ts', code);
