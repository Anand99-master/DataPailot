import {
  DatabaseAdapter,
  DiscoveredTable,
  TableDetailsResult,
  DatabaseRelationship,
  TableColumnInfo
} from '../database/DatabaseAdapter';

export interface TableSchemaContext {
  schemaName: string;
  tableName: string;
  fullTableName: string;
  tableType: string;
  columns: {
    name: string;
    dataType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    columnDefault: string | null;
  }[];
  primaryKeys: string[];
  foreignKeys: {
    column: string;
    targetSchema: string;
    targetTable: string;
    targetColumn: string;
  }[];
}

export interface SchemaContextResult {
  tables: TableSchemaContext[];
  relationships: DatabaseRelationship[];
  selectedTableContext?: string;
  databaseType: string;
  totalTablesCount: number;
  omittedTablesCount: number;
  formattedPromptContext: string;
  availableTableNames: string[];
}

export class SchemaContextService {
  /**
   * Retrieves and filters verified schema context for the AI prompt
   */
  public static async buildContext(
    adapter: DatabaseAdapter,
    question: string,
    selectedTable?: { schema: string; name: string }
  ): Promise<SchemaContextResult> {
    // 1. Get all tables and relationships from the database adapter
    const allTables = await adapter.getTables();
    const relationships = await adapter.getRelationships();

    const availableTableNames = allTables.map(t => `${t.schema}.${t.name}`);

    // If no tables discovered
    if (allTables.length === 0) {
      return {
        tables: [],
        relationships: [],
        databaseType: adapter.type,
        totalTablesCount: 0,
        omittedTablesCount: 0,
        formattedPromptContext: 'NO_TABLES_FOUND: The connected database currently has no accessible user tables.',
        availableTableNames: []
      };
    }

    // 2. Determine relevant tables based on question tokens and selected table
    const relevantTables = this.rankRelevantTables(allTables, relationships, question, selectedTable);

    // 3. For each relevant table, fetch full column details
    const tableContexts: TableSchemaContext[] = [];

    for (const tbl of relevantTables) {
      const details: TableDetailsResult = await adapter.getTableDetails(tbl.schema, tbl.name);
      if (!details) continue;

      const fks = (details.outgoingRelationships || []).map(r => ({
        column: r.sourceColumn,
        targetSchema: r.targetSchema,
        targetTable: r.targetTable,
        targetColumn: r.targetColumn
      }));

      const pks = details.columns
        .filter((c: TableColumnInfo) => c.isPrimaryKey)
        .map((c: TableColumnInfo) => c.name);

      tableContexts.push({
        schemaName: tbl.schema,
        tableName: tbl.name,
        fullTableName: `${tbl.schema}.${tbl.name}`,
        tableType: tbl.type,
        columns: details.columns.map((c: TableColumnInfo) => ({
          name: c.name,
          dataType: c.dataType,
          isNullable: c.isNullable,
          isPrimaryKey: c.isPrimaryKey,
          isForeignKey: c.isForeignKey,
          columnDefault: c.defaultValue || null
        })),
        primaryKeys: pks,
        foreignKeys: fks
      });
    }

    // 4. Format verified schema context into strict, concise prompt text
    const formattedPromptContext = this.formatContextString(
      tableContexts,
      relationships,
      selectedTable,
      allTables.length,
      allTables.length - relevantTables.length,
      adapter.type
    );

    return {
      tables: tableContexts,
      relationships,
      selectedTableContext: selectedTable ? `${selectedTable.schema}.${selectedTable.name}` : undefined,
      databaseType: adapter.type,
      totalTablesCount: allTables.length,
      omittedTablesCount: allTables.length - relevantTables.length,
      formattedPromptContext,
      availableTableNames
    };
  }

  /**
   * Filters and ranks tables based on semantic relevance to the question.
   * If total tables <= 20, includes all tables.
   * If > 20, scores relevance using query tokens and foreign-key graph.
   */
  private static rankRelevantTables(
    allTables: DiscoveredTable[],
    relationships: DatabaseRelationship[],
    question: string,
    selectedTable?: { schema: string; name: string }
  ): DiscoveredTable[] {
    // If small database, return all tables (up to 20 tables)
    if (allTables.length <= 20) {
      return allTables;
    }

    const normalizedQuestion = question.toLowerCase();
    const tokens = normalizedQuestion
      .replace(/[^a-z0-9_\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);

    const scoredTables = allTables.map(t => {
      let score = 0;
      const lowerName = t.name.toLowerCase();
      const lowerSchema = t.schema.toLowerCase();

      // Priority if this is the currently selected table in the explorer
      if (
        selectedTable &&
        selectedTable.name.toLowerCase() === lowerName &&
        selectedTable.schema.toLowerCase() === lowerSchema
      ) {
        score += 50;
      }

      // Direct table name matching
      if (normalizedQuestion.includes(lowerName)) {
        score += 30;
      }

      // Token matching
      for (const token of tokens) {
        if (lowerName === token) score += 20;
        else if (lowerName.includes(token) || token.includes(lowerName)) score += 10;
      }

      // Prefer standard 'public' schema over system schemas
      if (lowerSchema === 'public') {
        score += 2;
      }

      return { table: t, score };
    });

    // Sort by score descending
    scoredTables.sort((a, b) => b.score - a.score);

    // Take top matching tables (up to 10)
    const topScored = scoredTables.slice(0, 10).map(item => item.table);
    const selectedSet = new Set(topScored.map(t => `${t.schema}.${t.name}`));

    // Add directly related tables via foreign keys
    for (const rel of relationships) {
      const source = `${rel.sourceSchema}.${rel.sourceTable}`;
      const target = `${rel.targetSchema}.${rel.targetTable}`;

      if (selectedSet.has(source) && !selectedSet.has(target)) {
        const targetTableObj = allTables.find(
          t => t.schema === rel.targetSchema && t.name === rel.targetTable
        );
        if (targetTableObj && selectedSet.size < 16) {
          topScored.push(targetTableObj);
          selectedSet.add(target);
        }
      } else if (selectedSet.has(target) && !selectedSet.has(source)) {
        const sourceTableObj = allTables.find(
          t => t.schema === rel.sourceSchema && t.name === rel.sourceTable
        );
        if (sourceTableObj && selectedSet.size < 16) {
          topScored.push(sourceTableObj);
          selectedSet.add(source);
        }
      }
    }

    return topScored;
  }

  /**
   * Formats the schema context into a clean, unambiguous representation
   */
  private static formatContextString(
    tables: TableSchemaContext[],
    relationships: DatabaseRelationship[],
    selectedTable?: { schema: string; name: string },
    totalTablesCount: number = tables.length,
    omittedTablesCount: number = 0,
    databaseType: string = 'unknown'
  ): string {
    const lines: string[] = [];

    lines.push('### VERIFIED DATABASE SCHEMA CONTEXT:');
    lines.push(`DIALECT: ${databaseType}`);
    if (selectedTable) {
      lines.push(`ACTIVE_SELECTED_TABLE: "${selectedTable.schema}"."${selectedTable.name}"`);
    }
    lines.push(`TOTAL_TABLES_IN_DATABASE: ${totalTablesCount}`);
    if (omittedTablesCount > 0) {
      lines.push(`NOTE: ${omittedTablesCount} non-relevant tables omitted for brevity.`);
    }
    lines.push('');

    // Tables & Columns
    lines.push('### TABLES & COLUMNS:');
    for (const table of tables) {
      lines.push(`Table: "${table.schemaName}"."${table.tableName}" (${table.tableType})`);
      for (const col of table.columns) {
        let colMeta = `  - ${col.name} (${col.dataType})`;
        if (col.isPrimaryKey) colMeta += ' [PRIMARY KEY]';
        if (col.isForeignKey) colMeta += ' [FOREIGN KEY]';
        if (!col.isNullable) colMeta += ' [NOT NULL]';
        lines.push(colMeta);
      }
      lines.push('');
    }

    // Relationships
    lines.push('### CONFIRMED RELATIONSHIPS (JOIN PATHS):');
    const tableSet = new Set(tables.map(t => `${t.schemaName}.${t.tableName}`));
    const relevantRelationships = relationships.filter(
      r => tableSet.has(`${r.sourceSchema}.${r.sourceTable}`) || tableSet.has(`${r.targetSchema}.${r.targetTable}`)
    );

    if (relevantRelationships.length > 0) {
      for (const rel of relevantRelationships) {
        lines.push(
          `  "${rel.sourceSchema}"."${rel.sourceTable}"."${rel.sourceColumn}" -> "${rel.targetSchema}"."${rel.targetTable}"."${rel.targetColumn}"`
        );
      }
    } else {
      lines.push('  (No explicit foreign keys detected among these tables)');
    }

    return lines.join('\n');
  }
}
