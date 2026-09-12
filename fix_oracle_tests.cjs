const fs = require('fs');
let content = fs.readFileSync('tests/runDatabaseAdapterTests.ts', 'utf8');

content = content.replace(
  "assert(sqlServerDialect.formatLimit('SELECT * FROM a', 10).includes('FETCH NEXT 10 ROWS ONLY'), 'SQL Server formats LIMIT correctly');",
  `assert(sqlServerDialect.formatLimit('SELECT * FROM a', 10).includes('FETCH NEXT 10 ROWS ONLY'), 'SQL Server formats LIMIT correctly');
    
    // Oracle tests
    const oracleParams: DatabaseConnectionParams = { type: 'oracle', host: 'localhost', database: 'ORCLCDB', username: 'system', password: 'password' };
    const oracleAdapter = DatabaseAdapterFactory.create(oracleParams);
    assert(oracleAdapter.getDatabaseType() === 'Oracle', 'Factory creates Oracle adapter correctly');
    
    // Try connection test (might fail if no server, but we assert it doesn't crash)
    let oracleConnectHandled = false;
    try {
      const oracleTest = await oracleAdapter.testConnection();
      oracleConnectHandled = true;
    } catch(e) {
      // shouldn't throw, just return success: false
    }
    assert(oracleConnectHandled, 'Oracle handles connection test safely');
    
    // Test dialect logic
    const oracleDialect = oracleAdapter.getDialect();
    assert(oracleDialect.quoteIdentifier('table') === '"table"', 'Oracle quotes identifiers correctly');
    assert(oracleDialect.qualifyTable('SCHEMA', 'table') === '"SCHEMA"."table"', 'Oracle qualifies schema correctly');
    assert(oracleDialect.formatLimit('SELECT * FROM a', 10).includes('FETCH FIRST 10 ROWS ONLY'), 'Oracle formats LIMIT correctly');
    `
);

fs.writeFileSync('tests/runDatabaseAdapterTests.ts', content);
