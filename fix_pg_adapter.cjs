const fs = require('fs');
let content = fs.readFileSync('server/database/PostgreSQLAdapter.ts', 'utf8');

// Insert imports
content = content.replace(
  "import { SchemaIntrospection } from './SchemaIntrospection';",
  "import { SchemaIntrospection } from './SchemaIntrospection';\nimport { DatabaseCapabilities } from './DatabaseCapabilities';\nimport { SqlDialect } from './SqlDialect';\nimport { DatabaseMetadata, ColumnMetadata, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo } from './DatabaseAdapter';"
);

// Add methods
const methods = `
  public getDatabaseType(): string {
    return 'PostgreSQL';
  }

  public getCapabilities(): DatabaseCapabilities {
    return {
      transactions: true,
      explain: true,
      cancelQuery: true,
      schemas: true,
      foreignKeys: true,
      indexes: true,
      windowFunctions: true,
      dateFunctions: true,
      jsonFunctions: true,
      returning: true,
      limitSyntax: 'LIMIT'
    };
  }

  public getDialect(): SqlDialect {
    return {
      quoteIdentifier: (identifier: string) => \`"\${identifier.replace(/"/g, '""')}"\`,
      formatLimit: (sql: string, limit: number) => \`\${sql}\\nLIMIT \${limit}\`,
      formatPagination: (sql: string, limit: number, offset: number) => \`\${sql}\\nLIMIT \${limit} OFFSET \${offset}\`,
      formatDate: (date: Date) => \`'\${date.toISOString()}'::timestamp\`,
      formatExplain: (sql: string) => \`EXPLAIN \${sql}\`,
      qualifyTable: (schema: string | undefined, table: string) => schema ? \`"\${schema}"."\${table}"\` : \`"\${table}"\`
    };
  }

  public async getDatabaseMetadata(): Promise<DatabaseMetadata> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query('SELECT version();');
      const ver = res.rows[0]?.version || 'PostgreSQL';
      return {
        version: ver,
        database: this.config.database || '',
        system: 'PostgreSQL'
      };
    } finally {
      client.release();
    }
  }

  public async listSchemas(): Promise<string[]> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query(\`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
      \`);
      return res.rows.map(r => r.schema_name);
    } finally {
      client.release();
    }
  }

  public async listTables(schema?: string): Promise<DiscoveredTable[]> {
    return this.getTables(schema);
  }

  public async getTableColumns(schema: string, table: string): Promise<ColumnMetadata[]> {
    const details = await this.getTableDetails(schema, table);
    return details.columns.map(c => ({
      name: c.name,
      dataType: c.dataType,
      isNullable: c.isNullable,
      defaultValue: c.defaultValue
    }));
  }

  public async getPrimaryKeys(schema: string, table: string): Promise<PrimaryKeyInfo[]> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query(\`
        SELECT a.attname as column_name, c.conname as constraint_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        JOIN pg_constraint c ON c.conrelid = i.indrelid AND c.contype = 'p'
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname = $1 AND n.nspname = $2 AND i.indisprimary;
      \`, [table, schema]);
      return res.rows.map(r => ({ columnName: r.column_name, constraintName: r.constraint_name }));
    } finally {
      client.release();
    }
  }

  public async getForeignKeys(schema: string, table: string): Promise<ForeignKeyInfo[]> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query(\`
        SELECT
            tc.constraint_name,
            kcu.column_name AS source_column,
            ccu.table_schema AS target_schema,
            ccu.table_name AS target_table,
            ccu.column_name AS target_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2;
      \`, [schema, table]);
      return res.rows.map(r => ({
        constraintName: r.constraint_name,
        sourceColumn: r.source_column,
        targetSchema: r.target_schema,
        targetTable: r.target_table,
        targetColumn: r.target_column
      }));
    } finally {
      client.release();
    }
  }

  public async getIndexes(schema: string, table: string): Promise<IndexInfo[]> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query(\`
        SELECT
          ix.relname as index_name,
          i.indisunique as is_unique,
          i.indisprimary as is_primary,
          ARRAY(
            SELECT pg_get_indexdef(i.indexrelid, k + 1, true)
            FROM generate_subscripts(i.indkey, 1) as k
            ORDER BY k
          ) as column_names
        FROM pg_class t
        JOIN pg_index i ON t.oid = i.indrelid
        JOIN pg_class ix ON ix.oid = i.indexrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname = $1 AND n.nspname = $2;
      \`, [table, schema]);
      return res.rows.map(r => ({
        indexName: r.index_name,
        isUnique: r.is_unique,
        isPrimary: r.is_primary,
        columnNames: r.column_names
      }));
    } finally {
      client.release();
    }
  }

  public async executeReadOnlyQuery(sql: string, options?: QueryExecutionOptions): Promise<QueryResultData> {
    return this.executeQuery(sql, options);
  }

  public async cancelQuery(queryId?: string): Promise<boolean> {
    if (!queryId) return false;
    const client = await this.pool!.connect();
    try {
      // Best effort cancel backend
      const res = await client.query('SELECT pg_cancel_backend($1::int)', [parseInt(queryId)]);
      return res.rows[0]?.pg_cancel_backend || false;
    } catch {
      return false;
    } finally {
      client.release();
    }
  }

  public async explainQuery(sql: string): Promise<QueryResultData> {
    return this.executeReadOnlyQuery(this.getDialect().formatExplain(sql));
  }
`;

content = content.replace(
  "public async getTables",
  methods + "\n  public async getTables"
);

fs.writeFileSync('server/database/PostgreSQLAdapter.ts', content);
