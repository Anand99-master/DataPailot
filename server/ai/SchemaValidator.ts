import { TableSchemaContext } from './SchemaContextService';

export interface SchemaValidationResult {
  isValid: boolean;
  invalidTables: string[];
  invalidColumns: { table?: string; column: string; reason: string }[];
  details?: string;
}

const COMMON_SQL_KEYWORDS_AND_FUNCTIONS = new Set([
  'select', 'from', 'where', 'join', 'inner', 'left', 'right', 'full', 'outer', 'cross',
  'on', 'group', 'by', 'having', 'order', 'limit', 'offset', 'asc', 'desc', 'nulls', 'first', 'last',
  'as', 'and', 'or', 'not', 'in', 'is', 'null', 'between', 'like', 'ilike', 'similar', 'to',
  'case', 'when', 'then', 'else', 'end', 'with', 'recursive', 'union', 'all', 'intersect', 'except',
  'distinct', 'count', 'sum', 'avg', 'min', 'max', 'coalesce', 'nullif', 'greatest', 'least',
  'date_trunc', 'extract', 'date_part', 'now', 'current_date', 'current_timestamp', 'age',
  'to_char', 'to_date', 'to_number', 'concat', 'substring', 'trim', 'lower', 'upper', 'round', 'floor', 'ceil',
  'row_number', 'rank', 'dense_rank', 'ntile', 'lag', 'lead', 'first_value', 'last_value', 'over', 'partition',
  'cast', 'true', 'false', 'exists', 'any', 'all', 'interval', 'text', 'integer', 'numeric', 'date', 'timestamp', 'boolean'
]);

export class SchemaValidator {
  /**
   * Validates generated SQL against verified schema tables and columns
   */
  public static validate(
    sql: string,
    knownTables: TableSchemaContext[]
  ): SchemaValidationResult {
    const invalidTables: string[] = [];
    const invalidColumns: { table?: string; column: string; reason: string }[] = [];

    // Fast lookup for known tables: lowercase "table" and "schema.table"
    const tableMap = new Map<string, TableSchemaContext>();
    for (const t of knownTables) {
      tableMap.set(t.tableName.toLowerCase(), t);
      tableMap.set(`${t.schemaName.toLowerCase()}.${t.tableName.toLowerCase()}`, t);
    }

    // 1. Strip string literals, comments, and double quotes to avoid false positives
    const strippedSql = sql
      .replace(/--.*$/gm, '') // single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // multi-line comments
      .replace(/'(?:''|[^'])*'/g, "''"); // string literals

    // 2. Extract referenced tables and aliases from FROM and JOIN clauses
    // Matches patterns like:
    // FROM table_name [AS] alias
    // JOIN "schema"."table" alias
    const fromJoinRegex = /\b(?:from|join)\s+([a-zA-Z0-9_".]+)(?:\s+(?:as\s+)?([a-zA-Z0-9_"]+))?/gi;
    let match: RegExpExecArray | null;

    const referencedTables: { rawName: string; cleanName: string; alias?: string; schemaTable?: TableSchemaContext }[] = [];
    const aliasMap = new Map<string, TableSchemaContext>();

    while ((match = fromJoinRegex.exec(strippedSql)) !== null) {
      const rawTable = match[1];
      const rawAlias = match[2];

      // Ignore subquery aliases or keywords like (SELECT ... ) AS subq
      if (rawTable.startsWith('(') || COMMON_SQL_KEYWORDS_AND_FUNCTIONS.has(rawTable.toLowerCase())) {
        continue;
      }

      const cleanTable = rawTable.replace(/"/g, '').toLowerCase();
      const cleanAlias = rawAlias ? rawAlias.replace(/"/g, '').toLowerCase() : undefined;

      // Match against known tables
      let matchedTable: TableSchemaContext | undefined;
      if (cleanTable.includes('.')) {
        matchedTable = tableMap.get(cleanTable);
      } else {
        matchedTable = tableMap.get(cleanTable);
      }

      if (!matchedTable) {
        // Table does not exist in the introspected schema
        invalidTables.push(rawTable);
      } else {
        referencedTables.push({
          rawName: rawTable,
          cleanName: cleanTable,
          alias: cleanAlias,
          schemaTable: matchedTable
        });

        if (cleanAlias && !COMMON_SQL_KEYWORDS_AND_FUNCTIONS.has(cleanAlias)) {
          aliasMap.set(cleanAlias, matchedTable);
        }
        // Also map table name directly as alias
        aliasMap.set(matchedTable.tableName.toLowerCase(), matchedTable);
      }
    }

    if (invalidTables.length > 0) {
      const availableList = knownTables.map(t => `"${t.schemaName}"."${t.tableName}"`).join(', ');
      return {
        isValid: false,
        invalidTables,
        invalidColumns: [],
        details: `Invalid table(s) referenced: ${invalidTables.join(', ')}. Available tables in database: ${availableList || '(none)'}.`
      };
    }

    // 3. Extract qualified column references: alias.column or table.column
    const qualifiedColRegex = /\b([a-zA-Z0-9_"]+)\.([a-zA-Z0-9_"]+)\b/g;
    while ((match = qualifiedColRegex.exec(strippedSql)) !== null) {
      const qualifier = match[1].replace(/"/g, '').toLowerCase();
      const colName = match[2].replace(/"/g, '').toLowerCase();

      // If qualifier is a schema name matching table, skip as it was handled
      if (tableMap.has(`${qualifier}.${colName}`)) {
        continue;
      }

      // If qualifier is a table or alias
      const targetTable = aliasMap.get(qualifier);
      if (targetTable) {
        // Verify colName exists in targetTable.columns
        const colExists = targetTable.columns.some(c => c.name.toLowerCase() === colName);
        if (!colExists) {
          invalidColumns.push({
            table: `"${targetTable.schemaName}"."${targetTable.tableName}"`,
            column: colName,
            reason: `Column '${colName}' does not exist in table '${targetTable.tableName}'. Available columns: [${targetTable.columns.map(c => c.name).join(', ')}]`
          });
        }
      }
    }

    // 4. If single table query, check simple unqualified columns in SELECT / WHERE / GROUP BY / ORDER BY
    if (referencedTables.length === 1 && referencedTables[0].schemaTable) {
      const singleTable = referencedTables[0].schemaTable;
      const validColNames = new Set(singleTable.columns.map(c => c.name.toLowerCase()));

      // Extract words that might be column identifiers
      const words = strippedSql
        .replace(/'[^']*'/g, '') // remove literals
        .replace(/\b\d+(?:\.\d+)?\b/g, '') // remove numbers
        .match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];

      for (const word of words) {
        const lower = word.toLowerCase();
        if (
          COMMON_SQL_KEYWORDS_AND_FUNCTIONS.has(lower) ||
          lower === singleTable.tableName.toLowerCase() ||
          lower === singleTable.schemaName.toLowerCase() ||
          (referencedTables[0].alias && lower === referencedTables[0].alias)
        ) {
          continue;
        }

        // Check if word is a column
        // We only flag if word appears in SELECT or WHERE or GROUP BY and does not match any valid column
        // but avoid false positive on aliases defined like "AS my_alias"
        const isAliasDefinition = new RegExp(`\\bas\\s+${word}\\b`, 'i').test(strippedSql);
        if (isAliasDefinition) {
          continue;
        }

        // If it looks like an identifier in a projection or filter but doesn't exist
        if (
          !validColNames.has(lower) &&
          (new RegExp(`\\bselect\\b[\\s\\S]*?\\b${word}\\b`, 'i').test(strippedSql) ||
           new RegExp(`\\bwhere\\b[\\s\\S]*?\\b${word}\\b`, 'i').test(strippedSql))
        ) {
          // Check if it's already recorded
          if (!invalidColumns.some(c => c.column.toLowerCase() === lower)) {
            invalidColumns.push({
              table: `"${singleTable.schemaName}"."${singleTable.tableName}"`,
              column: word,
              reason: `Column '${word}' does not exist in table '${singleTable.tableName}'. Available columns: [${singleTable.columns.map(c => c.name).join(', ')}]`
            });
          }
        }
      }
    }

    if (invalidColumns.length > 0) {
      return {
        isValid: false,
        invalidTables: [],
        invalidColumns,
        details: invalidColumns.map(c => c.reason).join('; ')
      };
    }

    return {
      isValid: true,
      invalidTables: [],
      invalidColumns: []
    };
  }
}
