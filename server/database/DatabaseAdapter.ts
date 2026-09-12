import { DatabaseCapabilities } from './DatabaseCapabilities';
import { SqlDialect } from './SqlDialect';

export interface DatabaseConnectionParams {
  type: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  filePath?: string; // For SQLite
}

export interface ConnectionTestResult {
  success: boolean;
  databaseType: string;
  databaseName: string;
  serverVersion?: string;
  latencyMs: number;
  error?: string;
  errorCode?: string;
}

export interface DiscoveredTable {
  schema: string;
  name: string;
  type: string; // 'BASE TABLE' | 'VIEW'
  approximateRowCount?: number;
}

export interface TableColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTarget?: {
    schema: string;
    table: string;
    column: string;
    constraintName?: string;
  };
}

export interface DatabaseRelationship {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
}

export interface TableDetailsResult {
  schema: string;
  name: string;
  type: string;
  columnCount: number;
  approximateRowCount?: number;
  columns: TableColumnInfo[];
  outgoingRelationships: DatabaseRelationship[];
  incomingRelationships: DatabaseRelationship[];
}

export interface QueryExecutionOptions {
  maxRows?: number;
  timeoutMs?: number;
  queryId?: string;
}

export interface QueryResultColumn {
  name: string;
  dataType: string;
}

export interface QueryResultData {
  columns: QueryResultColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  isTruncated?: boolean;
  totalAvailableRows?: number;
}

export interface DatabaseMetadata {
  version: string;
  database: string;
  system: string;
}

export interface ColumnMetadata {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue?: string | null;
}

export interface PrimaryKeyInfo {
  columnName: string;
  constraintName: string;
}

export interface ForeignKeyInfo {
  constraintName: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
}

export interface IndexInfo {
  indexName: string;
  columnNames: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface DatabaseAdapter {
  readonly type: string;
  
  // Core Connection
  testConnection(): Promise<ConnectionTestResult>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Metadata & Features
  getDatabaseType(): string;
  getCapabilities(): DatabaseCapabilities;
  getDialect(): SqlDialect;
  
  // Schema Discovery
  getDatabaseMetadata(): Promise<DatabaseMetadata>;
  listSchemas(): Promise<string[]>;
  listTables(schema?: string): Promise<DiscoveredTable[]>;
  getTableColumns(schema: string, table: string): Promise<ColumnMetadata[]>;
  getPrimaryKeys(schema: string, table: string): Promise<PrimaryKeyInfo[]>;
  getForeignKeys(schema: string, table: string): Promise<ForeignKeyInfo[]>;
  getIndexes(schema: string, table: string): Promise<IndexInfo[]>;
  getRelationships(schema?: string): Promise<DatabaseRelationship[]>;
  
  // Composite backward-compatible methods
  getTables(schema?: string): Promise<DiscoveredTable[]>;
  getTableDetails(schema: string, tableName: string): Promise<TableDetailsResult>;
  
  // Query Execution
  executeReadOnlyQuery(sql: string, options?: QueryExecutionOptions): Promise<QueryResultData>;
  cancelQuery(queryId?: string): Promise<boolean>;
  explainQuery(sql: string): Promise<QueryResultData>;
}
