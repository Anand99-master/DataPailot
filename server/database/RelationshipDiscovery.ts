import { PoolClient } from 'pg';
import { DatabaseRelationship } from './DatabaseAdapter';

export class RelationshipDiscovery {
  /**
   * Introspects confirmed foreign key relationships from PostgreSQL information_schema.
   */
  public static async discoverRelationships(
    client: PoolClient,
    schema?: string
  ): Promise<DatabaseRelationship[]> {
    const query = `
      SELECT
        tc.constraint_name,
        tc.table_schema AS source_schema,
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_schema AS target_schema,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ($1::text IS NULL OR tc.table_schema = $1)
      ORDER BY tc.table_schema, tc.table_name, kcu.column_name;
    `;

    const res = await client.query(query, [schema || null]);
    return res.rows.map(row => ({
      constraintName: row.constraint_name,
      sourceSchema: row.source_schema,
      sourceTable: row.source_table,
      sourceColumn: row.source_column,
      targetSchema: row.target_schema,
      targetTable: row.target_table,
      targetColumn: row.target_column
    }));
  }
}
