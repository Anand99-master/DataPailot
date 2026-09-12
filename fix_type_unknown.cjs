const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "tableName: r.tablename,",
  "tableName: String(r.tablename),"
);
content = content.replace(
  "indexName: r.indexname,",
  "indexName: String(r.indexname),"
);
content = content.replace(
  "const def = r.indexdef || '';",
  "const def = String(r.indexdef || '');"
);

fs.writeFileSync('src/App.tsx', content);
