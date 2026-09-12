import { 
  DatabaseAdapter, DatabaseConnectionParams, ConnectionTestResult, DiscoveredTable, 
  TableDetailsResult, DatabaseRelationship, QueryResultData, QueryExecutionOptions,
  DatabaseMetadata, ColumnMetadata, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo 
} from './DatabaseAdapter';
import { DatabaseCapabilities } from './DatabaseCapabilities';
import { SqlDialect } from './SqlDialect';

export abstract class AbstractDatabaseAdapter implements DatabaseAdapter {
  constructor(protected config: DatabaseConnectionParams) {}

  public get type(): string {
    return this.config.type;
  }

  public abstract testConnection(): Promise<ConnectionTestResult>;
  public abstract connect(): Promise<void>;
  public abstract disconnect(): Promise<void>;
  public abstract isConnected(): boolean;
  public abstract getDatabaseType(): string;
  public abstract getCapabilities(): DatabaseCapabilities;
  public abstract getDialect(): SqlDialect;
  public abstract getDatabaseMetadata(): Promise<DatabaseMetadata>;
  public abstract listSchemas(): Promise<string[]>;
  public abstract listTables(schema?: string): Promise<DiscoveredTable[]>;
  public abstract getTableColumns(schema: string, table: string): Promise<ColumnMetadata[]>;
  public abstract getPrimaryKeys(schema: string, table: string): Promise<PrimaryKeyInfo[]>;
  public abstract getForeignKeys(schema: string, table: string): Promise<ForeignKeyInfo[]>;
  public abstract getIndexes(schema: string, table: string): Promise<IndexInfo[]>;
  public abstract getRelationships(schema?: string): Promise<DatabaseRelationship[]>;
  public abstract getTables(schema?: string): Promise<DiscoveredTable[]>;
  public abstract getTableDetails(schema: string, tableName: string): Promise<TableDetailsResult>;
  public abstract executeReadOnlyQuery(sql: string, options?: QueryExecutionOptions): Promise<QueryResultData>;
  public abstract cancelQuery(queryId?: string): Promise<boolean>;
  public abstract explainQuery(sql: string): Promise<QueryResultData>;

  /**
   * Normalizes raw array rows and metadata from drivers that support array rows.
   * Ensures duplicate column names are suffixed (e.g., id, id_1, id_2) so objects remain intact.
   */
  protected normalizeArrayRowResults(
    columnsMeta: { name: string, dataType: string }[], 
    arrayRows: any[][]
  ): { columns: { name: string, dataType: string }[], rows: any[] } {
    const uniqueNames = new Set<string>();
    const colNames: string[] = [];
    const finalColumns: { name: string, dataType: string }[] = [];

    for (const meta of columnsMeta) {
      let name = meta.name;
      let counter = 1;
      while (uniqueNames.has(name)) {
        name = `${meta.name}_${counter}`;
        counter++;
      }
      uniqueNames.add(name);
      colNames.push(name);
      finalColumns.push({
        ...meta,
        name
      });
    }

    const rows = arrayRows.map(rowArray => {
      const obj: Record<string, any> = {};
      rowArray.forEach((val, i) => {
        obj[colNames[i]] = val;
      });
      return obj;
    });

    return { columns: finalColumns, rows };
  }
}

