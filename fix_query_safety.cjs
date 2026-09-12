const fs = require('fs');

let content = fs.readFileSync('server/database/QuerySafetyValidator.ts', 'utf8');

// Add new keywords
content = content.replace(
  "    'PRAGMA'",
  "    'PRAGMA',\n    'DBCC',\n    'BACKUP',\n    'RESTORE',\n    'DENY',\n    'OPENROWSET'"
);

// Add new regexes
content = content.replace(
  "      PRAGMA: /\\bPRAGMA\\b/i",
  "      PRAGMA: /\\bPRAGMA\\b/i,\n      DBCC: /\\bDBCC\\b/i,\n      BACKUP: /\\bBACKUP\\b/i,\n      RESTORE: /\\bRESTORE\\b/i,\n      DENY: /\\bDENY\\b/i,\n      OPENROWSET: /\\bOPENROWSET\\b/i,\n      'BULK INSERT': /\\bBULK\\s+INSERT\\b/i"
);

// We need 'BULK INSERT' in keywords array too
content = content.replace(
  "    'OPENROWSET'",
  "    'OPENROWSET',\n    'BULK INSERT'"
);

fs.writeFileSync('server/database/QuerySafetyValidator.ts', content);
