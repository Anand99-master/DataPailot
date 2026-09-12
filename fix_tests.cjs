const fs = require('fs');
let content = fs.readFileSync('tests/runDatabaseAdapterTests.ts', 'utf8');

content = content.replace(
  "assert(mysqlDialect.formatLimit('SELECT * FROM a', 10) === 'SELECT * FROM a\\nLIMIT 10', 'MySQL formats LIMIT correctly');",
  `assert(mysqlDialect.formatLimit('SELECT * FROM a', 10) === 'SELECT * FROM a\\nLIMIT 10', 'MySQL formats LIMIT correctly');
    
    // SQL Server tests
    const sqlServerParams: DatabaseConnectionParams = { type: 'sqlserver', host: 'localhost', database: 'test', username: 'sa', password: 'Password1!' };
    const sqlServerAdapter = DatabaseAdapterFactory.create(sqlServerParams);
    assert(sqlServerAdapter.getDatabaseType() === 'SQL Server', 'Factory creates SQL Server adapter correctly');
    
    // Try connection test (might fail if no server, but we assert it doesn't crash)
    let sqlServerConnectHandled = false;
    try {
      const sqlTest = await sqlServerAdapter.testConnection();
      sqlServerConnectHandled = true;
    } catch(e) {
      // shouldn't throw, just return success: false
    }
    assert(sqlServerConnectHandled, 'SQL Server handles connection test safely');
    
    // Test dialect logic
    const sqlServerDialect = sqlServerAdapter.getDialect();
    assert(sqlServerDialect.quoteIdentifier('table') === '[table]', 'SQL Server quotes identifiers correctly');
    assert(sqlServerDialect.qualifyTable('dbo', 'table') === '[dbo].[table]', 'SQL Server qualifies schema correctly');
    assert(sqlServerDialect.formatLimit('SELECT * FROM a', 10).includes('FETCH NEXT 10 ROWS ONLY'), 'SQL Server formats LIMIT correctly');
    `
);

fs.writeFileSync('tests/runDatabaseAdapterTests.ts', content);
