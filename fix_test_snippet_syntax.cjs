const fs = require('fs');
let content = fs.readFileSync('tests/testSqlSnippets.ts', 'utf8');
content = content.replace(/\\`/g, "`").replace(/\\\$/g, "$");
fs.writeFileSync('tests/testSqlSnippets.ts', content);
