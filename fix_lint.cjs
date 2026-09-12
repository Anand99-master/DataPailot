const fs = require('fs');
let code = fs.readFileSync('tests/testPhase12Matrix.ts', 'utf8');

code = code.replace(
  "assert(false, `[${dbConfig.id}] LIVE DB TEST FAILED`, e.message + ' (Query: ' + (typeof q !== 'undefined' ? q : '') + ')');",
  "assert(false, `[${dbConfig.id}] LIVE DB TEST FAILED`, e.message);"
);

fs.writeFileSync('tests/testPhase12Matrix.ts', code);
