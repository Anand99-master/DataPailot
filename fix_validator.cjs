const fs = require('fs');
let content = fs.readFileSync('server/database/QuerySafetyValidator.ts', 'utf8');

content = content.replace(
  "'ANALYZE'",
  "'ANALYZE',\n    'ATTACH',\n    'DETACH',\n    'PRAGMA'"
);

content = content.replace(
  "ANALYZE: /\\bANALYZE\\b/i",
  "ANALYZE: /\\bANALYZE\\b/i,\n      ATTACH: /\\bATTACH\\b/i,\n      DETACH: /\\bDETACH\\b/i,\n      PRAGMA: /\\bPRAGMA\\b/i"
);

fs.writeFileSync('server/database/QuerySafetyValidator.ts', content);
