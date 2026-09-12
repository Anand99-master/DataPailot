const fs = require('fs');
let code = fs.readFileSync('tests/testPhase12Matrix.ts', 'utf8');
code = code.replace(
  "const q = dialect.formatLimit(`SELECT * FROM ${dialect.qualifyTable(table.schema, table.name)}`, 10);",
  "const q = dialect.formatLimit(`SELECT * FROM ${dialect.qualifyTable(table.schema, table.name)}`, 10);\n          // console.log(`[${dbConfig.id}] Executing: ${q}`);"
);
code = code.replace(
  "assert(false, `[${dbConfig.id}] LIVE DB TEST FAILED`, e.message);",
  "assert(false, `[${dbConfig.id}] LIVE DB TEST FAILED`, e.message + ' (Query: ' + (typeof q !== 'undefined' ? q : '') + ')');"
);
fs.writeFileSync('tests/testPhase12Matrix.ts', code);
