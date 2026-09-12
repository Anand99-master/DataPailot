import { DatabaseAdapterFactory } from '../server/database/DatabaseAdapterFactory';
import { DatabaseConnectionParams } from '../server/database/DatabaseAdapter';
import path from 'path';

export async function runDatabaseAdapterTests(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  
  function assert(condition: boolean, name: string, errorMsg?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: errorMsg || 'Assertion failed' });
    }
  }

  try {
    const pgParams: DatabaseConnectionParams = { type: 'postgresql', host: 'localhost', database: 'test' };
    const pgAdapter = DatabaseAdapterFactory.create(pgParams);
    assert(pgAdapter.getDatabaseType() === 'PostgreSQL', 'Factory creates PostgreSQL adapter correctly');
    
    const dbFile = path.resolve(process.cwd(), 'data/datapilot_demo.sqlite');
    const sqliteParams: DatabaseConnectionParams = { type: 'sqlite', filePath: dbFile };
    const sqliteAdapter = DatabaseAdapterFactory.create(sqliteParams);
    assert(sqliteAdapter.getDatabaseType() === 'SQLite', 'Factory creates SQLite adapter correctly');
    
    // SQLite Tests
    const testRes = await sqliteAdapter.testConnection();
    assert(testRes.success === true, 'SQLite connection test succeeds', testRes.error);
    
    await sqliteAdapter.connect();
    assert(sqliteAdapter.isConnected(), 'SQLite connects successfully');
    
    const tables = await sqliteAdapter.listTables();
    assert(tables.length >= 4, 'SQLite discovers tables');
    
    const columns = await sqliteAdapter.getTableColumns('main', 'customers');
    assert(columns.length === 5, 'SQLite discovers columns for customers');
    
    const pks = await sqliteAdapter.getPrimaryKeys('main', 'customers');
    assert(pks.length === 1 && pks[0].columnName === 'customer_id', 'SQLite discovers primary keys');
    
    const fks = await sqliteAdapter.getForeignKeys('main', 'orders');
    assert(fks.length === 1 && fks[0].targetTable === 'customers', 'SQLite discovers foreign keys');
    
    const data = await sqliteAdapter.executeReadOnlyQuery('SELECT * FROM customers');
    assert(data.rowCount >= 3, 'SQLite executes SELECT query');
    
    const cteData = await sqliteAdapter.executeReadOnlyQuery('WITH cte AS (SELECT * FROM products) SELECT * FROM cte');
    assert(cteData.rowCount >= 3, 'SQLite executes CTE query');
    
    let blocked = false;
    try {
      await sqliteAdapter.executeReadOnlyQuery('DELETE FROM customers');
    } catch(e: any) {
      if (e.message.toLowerCase().includes('blocked')) blocked = true;
    }
    assert(blocked, 'SQLite blocks DELETE (Read-only guard)');

    let pragmaBlocked = false;
    try {
      await sqliteAdapter.executeReadOnlyQuery('PRAGMA foreign_keys = OFF;');
    } catch(e: any) {
      if (e.message.toLowerCase().includes('blocked')) pragmaBlocked = true;
    }
    assert(pragmaBlocked, 'SQLite blocks PRAGMA write operations (Read-only guard)');
    
    const explainData = await sqliteAdapter.explainQuery('SELECT * FROM orders');
    assert(explainData.rows.length > 0, 'SQLite explains query safely');

    await sqliteAdapter.disconnect();
    assert(!sqliteAdapter.isConnected(), 'SQLite disconnects successfully');
    
    // MySQL tests
    const mysqlParams: DatabaseConnectionParams = { type: 'mysql', host: 'localhost', database: 'test', username: 'root' };
    const mysqlAdapter = DatabaseAdapterFactory.create(mysqlParams);
    assert(mysqlAdapter.getDatabaseType() === 'MySQL', 'Factory creates MySQL adapter correctly');
    
    // Try connection test (might fail if no server, but we assert it doesn't crash)
    let mysqlConnectHandled = false;
    try {
      const mysqlTest = await mysqlAdapter.testConnection();
      mysqlConnectHandled = true;
    } catch(e) {
      // shouldn't throw, just return success: false
    }
    assert(mysqlConnectHandled, 'MySQL handles connection test safely');
    
    // Test dialect logic
    const mysqlDialect = mysqlAdapter.getDialect();
    assert(mysqlDialect.quoteIdentifier('table') === '`table`', 'MySQL quotes identifiers correctly');
    assert(mysqlDialect.qualifyTable('schema', 'table') === '`schema`.`table`', 'MySQL qualifies schema correctly');
    assert(mysqlDialect.formatLimit('SELECT * FROM a', 10) === 'SELECT * FROM a\nLIMIT 10', 'MySQL formats LIMIT correctly');
    
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
    assert(sqlServerDialect.formatLimit('SELECT * FROM a', 10).includes('TOP (10)') || sqlServerDialect.formatLimit('SELECT * FROM a', 10).includes('TOP 10'), 'SQL Server formats LIMIT correctly');
    
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
    
    
    
    
  } catch (e: any) {
    results.push({ name: 'Adapter foundation tests', passed: false, error: e.message });
  }

  return results;
}
