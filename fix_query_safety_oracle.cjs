const fs = require('fs');
let content = fs.readFileSync('server/database/QuerySafetyValidator.ts', 'utf8');

// Add Oracle specific keywords
content = content.replace(
  "    'BULK INSERT'",
  "    'BULK INSERT',\n    'DECLARE',\n    'BEGIN',\n    'DBMS_'"
);

content = content.replace(
  "      'BULK INSERT': /\\bBULK\\s+INSERT\\b/i",
  "      'BULK INSERT': /\\bBULK\\s+INSERT\\b/i,\n      DECLARE: /\\bDECLARE\\b/i,\n      DBMS_: /\\bDBMS_[A-Z0-9_]+\\b/i,\n      PLSQL_BEGIN: /(^|;)\\s*BEGIN\\b/i"
);

fs.writeFileSync('server/database/QuerySafetyValidator.ts', content);
