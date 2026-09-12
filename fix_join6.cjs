const fs = require('fs');
let c = fs.readFileSync('server/database/AnalysisSqlGenerator.ts', 'utf8');

const regex = /const sql = this\.dialect\.formatLimit\(`SELECT\\nprojection\\nFROM \$\{baseTableFull\} \$\{baseAlias\}\\(\n|\\)?\$\{config\.joinType\} JOIN \$\{joinTableFull\} \$\{joinAlias\}\\n    ON \$\{onCondition\}`,\s*limit\)\s*\+\s*';';/g;

c = c.replace(regex, 
`let orderClause = '';
    if (this.dialect.requiresOrderByForLimit) {
        orderClause = \`\\nORDER BY \${baseAlias}.\${this.quoteIdentifier(config.baseColumn)} ASC\`;
    }
    const sql = this.dialect.formatLimit(\`SELECT\\n\${projection}\\nFROM \${baseTableFull} \${baseAlias}\\n\${config.joinType} JOIN \${joinTableFull} \${joinAlias}\\n    ON \${onCondition}\${orderClause}\`, limit) + ';';`);

fs.writeFileSync('server/database/AnalysisSqlGenerator.ts', c);
