const fs = require('fs');
let content = fs.readFileSync('tests/testSqlSnippets.ts', 'utf8');
content = content.replace(
  "/\\\\b(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|TRUNCATE)\\\\b/i",
  "/\\b(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|TRUNCATE)\\b/i"
);
fs.writeFileSync('tests/testSqlSnippets.ts', content);
