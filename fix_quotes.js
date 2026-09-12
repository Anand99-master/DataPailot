const fs = require('fs');
let c = fs.readFileSync('server/database/AnalysisSqlGenerator.ts', 'utf8');
c = c.replace('return `"clean"`;', 'return `"${clean}"`;');
c = c.replace('return `"this.quoteIdentifier(schema)"."this.quoteIdentifier(tableName)"`;', 'return `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(tableName)}`;');
fs.writeFileSync('server/database/AnalysisSqlGenerator.ts', c);
