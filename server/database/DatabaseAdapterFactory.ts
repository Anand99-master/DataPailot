import { DatabaseAdapter, DatabaseConnectionParams } from './DatabaseAdapter';
import { PostgreSQLAdapter } from './PostgreSQLAdapter';
import { MySQLAdapter } from './MySQLAdapter';
import { SQLServerAdapter } from './SQLServerAdapter';
import { SQLiteAdapter } from './SQLiteAdapter';
import { OracleAdapter } from './OracleAdapter';

export class DatabaseAdapterFactory {
  public static create(params: DatabaseConnectionParams): DatabaseAdapter {
    switch (params.type) {
      case 'postgresql':
        return new PostgreSQLAdapter(params);
      case 'mysql':
        return new MySQLAdapter(params);
      case 'sqlserver':
        return new SQLServerAdapter(params);
      case 'sqlite':
        return new SQLiteAdapter(params);
      case 'oracle':
        return new OracleAdapter(params);
      default:
        throw new Error(`Unsupported database type: ${params.type}. Supported types: postgresql, mysql, sqlserver, sqlite, oracle.`);
    }
  }
}
