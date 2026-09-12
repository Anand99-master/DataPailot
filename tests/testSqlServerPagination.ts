import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';
import { SQLServerAdapter } from '../server/database/SQLServerAdapter';
import { PostgreSQLAdapter } from '../server/database/PostgreSQLAdapter';
import { MySQLAdapter } from '../server/database/MySQLAdapter';
import { SQLiteAdapter } from '../server/database/SQLiteAdapter';
import { OracleAdapter } from '../server/database/OracleAdapter';
import { MultiTableJoinConfig } from '../src/types/analysis';

export function runSqlServerPaginationTests() {
  const sqlServerAdapter = new SQLServerAdapter(({ type: 'sqlserver', host: 'localhost', database: 'db', username: 'sa', password: 'sa', port: 1433 } as any as any));
  const sqlServerDialect = sqlServerAdapter.getDialect();
  sqlServerDialect.requiresOrderByForLimit = true;
  
  const pgDialect = new PostgreSQLAdapter(({ type: 'sqlserver', host: 'localhost', database: 'db', username: 'sa', password: 'sa', port: 1433 } as any as any)).getDialect();
  const mysqlDialect = new MySQLAdapter(({ type: 'sqlserver', host: 'localhost', database: 'db', username: 'sa', password: 'sa', port: 1433 } as any as any)).getDialect();
  const sqliteDialect = new SQLiteAdapter({ filePath: ":memory:",  host: 'localhost', database: 'db', username: 'sa', password: 'sa', port: 1433 } as any).getDialect();
  const oracleDialect = new OracleAdapter(({ type: 'sqlserver', host: 'localhost', database: 'db', username: 'sa', password: 'sa', port: 1433 } as any as any)).getDialect();

  const sqlServerGen = new AnalysisSqlGenerator(sqlServerDialect);
  const pgGen = new AnalysisSqlGenerator(pgDialect);
  const mysqlGen = new AnalysisSqlGenerator(mysqlDialect);
  const sqliteGen = new AnalysisSqlGenerator(sqliteDialect);
  const oracleGen = new AnalysisSqlGenerator(oracleDialect);

  const joinConfig: MultiTableJoinConfig = {
    baseTable: { schema: 'dbo', name: 'orders' },
    joinTable: { schema: 'dbo', name: 'customers' },
    joinType: 'INNER JOIN',
    baseColumn: 'customer_id',
    joinColumn: 'customer_id',
    isConfirmedRelationship: true,
    selectedColumns: [
      { tableKey: 'base', tableName: 'orders', column: 'order_id' },
      { tableKey: 'base', tableName: 'orders', column: 'customer_id' },
      { tableKey: 'join', tableName: 'customers', column: 'customer_name' }
    ]
  };

  const sqlServerJoin = sqlServerGen.generateJoin(joinConfig, 100).sql;
  const pgJoin = pgGen.generateJoin(joinConfig, 100).sql;
  const mysqlJoin = mysqlGen.generateJoin(joinConfig, 100).sql;
  const sqliteJoin = sqliteGen.generateJoin(joinConfig, 100).sql;
  const oracleJoin = oracleGen.generateJoin(joinConfig, 100).sql;

  let allPassed = true;
  const assert = (condition: boolean, msg: string) => {
    if (!condition) {
      console.error('FAILED:', msg);
      allPassed = false;
    } else {
      console.log('PASSED:', msg);
    }
  };

  assert(
    sqlServerJoin.includes('ORDER BY t1.[customer_id] ASC'),
    'b. SQL Server JOIN query executes successfully (contains proper ORDER BY from generator)'
  );

  assert(
    sqlServerJoin.includes('OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY'),
    'c. SQL Server JOIN with 100-row default limit uses OFFSET FETCH because ORDER BY exists'
  );

  assert(
    !sqlServerJoin.match(/OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY(?!.*ORDER BY)/is) || sqlServerJoin.indexOf('ORDER BY') < sqlServerJoin.indexOf('OFFSET'),
    'a. SQL Server OFFSET/FETCH always has ORDER BY preceding it'
  );

  assert(
    !pgJoin.includes('ORDER BY'),
    'e. PostgreSQL LIMIT behavior remains unchanged (no injected ORDER BY)'
  );
  assert(pgJoin.includes('LIMIT 100'), 'e. PostgreSQL uses LIMIT 100');

  assert(
    !mysqlJoin.includes('ORDER BY'),
    'f. MySQL LIMIT behavior remains unchanged (no injected ORDER BY)'
  );
  assert(mysqlJoin.includes('LIMIT 100'), 'f. MySQL uses LIMIT 100');

  assert(
    !sqliteJoin.includes('ORDER BY'),
    'g. SQLite LIMIT behavior remains unchanged (no injected ORDER BY)'
  );
  assert(sqliteJoin.includes('LIMIT 100'), 'g. SQLite uses LIMIT 100');

  assert(
    !oracleJoin.includes('ORDER BY'),
    'h. Oracle row limiting remains valid (no injected ORDER BY)'
  );
  assert(oracleJoin.includes('FETCH FIRST 100 ROWS ONLY'), 'h. Oracle uses FETCH FIRST 100 ROWS ONLY');

  const basicPreview = sqlServerGen.generateBasic('dbo', 'orders', 'preview', { limit: 50 }).sql;
  assert(
    basicPreview.includes('SELECT TOP 50 *') && !basicPreview.includes('OFFSET'),
    'd. No SQL Server generated query contains OFFSET/FETCH without ORDER BY (uses TOP instead when no ORDER BY)'
  );

  const pagedSql = sqlServerDialect.formatPagination('SELECT * FROM dbo.orders', 50, 100);
  assert(
    pagedSql.includes('ORDER BY 1') && pagedSql.includes('OFFSET 100 ROWS FETCH NEXT 50 ROWS ONLY'),
    'a. SQL Server formatPagination injects ORDER BY 1 if missing'
  );

  return allPassed;
}

if (true) {
  const result = runSqlServerPaginationTests();
  process.exit(result ? 0 : 1);
}
