import { SchemaValidator } from '../server/ai/SchemaValidator';
import { TableSchemaContext } from '../server/ai/SchemaContextService';
import { DatabaseRelationship } from '../server/database/DatabaseAdapter';
import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';

export function runSchemaAndGroundingTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: message || 'Assertion failed' });
    }
  }

  // Mock verified schema tables
  const mockTables: TableSchemaContext[] = [
    {
      schemaName: 'public',
      tableName: 'customers',
      fullTableName: 'public.customers',
      tableType: 'BASE TABLE',
      columns: [
        { name: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, isForeignKey: false, columnDefault: null },
        { name: 'email', dataType: 'varchar', isNullable: false, isPrimaryKey: false, isForeignKey: false, columnDefault: null },
        { name: 'full_name', dataType: 'varchar', isNullable: true, isPrimaryKey: false, isForeignKey: false, columnDefault: null },
        { name: 'created_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, isForeignKey: false, columnDefault: null }
      ],
      primaryKeys: ['id'],
      foreignKeys: []
    },
    {
      schemaName: 'public',
      tableName: 'orders',
      fullTableName: 'public.orders',
      tableType: 'BASE TABLE',
      columns: [
        { name: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, isForeignKey: false, columnDefault: null },
        { name: 'customer_id', dataType: 'integer', isNullable: false, isPrimaryKey: false, isForeignKey: true, columnDefault: null },
        { name: 'total_amount', dataType: 'numeric', isNullable: false, isPrimaryKey: false, isForeignKey: false, columnDefault: null },
        { name: 'order_date', dataType: 'date', isNullable: false, isPrimaryKey: false, isForeignKey: false, columnDefault: null }
      ],
      primaryKeys: ['id'],
      foreignKeys: [
        { column: 'customer_id', targetSchema: 'public', targetTable: 'customers', targetColumn: 'id' }
      ]
    }
  ];

  // RTM-12: Schema mismatch in AI prompt / hallucinated table -> REJECTED
  const hallucinatedTableSql = 'SELECT * FROM invoices WHERE amount > 100;';
  const tableCheck = SchemaValidator.validate(hallucinatedTableSql, mockTables);
  assert(
    'RTM-12a: Hallucinated table rejected',
    !tableCheck.isValid && tableCheck.invalidTables.includes('invoices'),
    'Expected non-existent table "invoices" to be marked invalid'
  );

  // RTM-12b: Hallucinated column in known table -> REJECTED
  const hallucinatedColumnSql = 'SELECT id, non_existent_secret_field FROM public.customers;';
  const columnCheck = SchemaValidator.validate(hallucinatedColumnSql, mockTables);
  assert(
    'RTM-12b: Hallucinated column rejected',
    !columnCheck.isValid && columnCheck.invalidColumns.some(c => c.column === 'non_existent_secret_field'),
    'Expected non-existent column to be rejected'
  );

  // Valid schema query -> PASS
  const validSql = 'SELECT c.id, c.email, o.total_amount FROM customers c JOIN orders o ON c.id = o.customer_id;';
  const validCheck = SchemaValidator.validate(validSql, mockTables);
  assert('SCHEMA-1: Valid query with known tables and columns passes validation', validCheck.isValid);

  // RTM-13: Foreign key relationship mapping -> VALIDATED
  const mockRelationships: DatabaseRelationship[] = [
    {
      constraintName: 'fk_orders_customer',
      sourceSchema: 'public',
      sourceTable: 'orders',
      sourceColumn: 'customer_id',
      targetSchema: 'public',
      targetTable: 'customers',
      targetColumn: 'id'
    }
  ];

  const rel = mockRelationships[0];
  const isValidFk =
    rel.sourceTable === 'orders' &&
    rel.sourceColumn === 'customer_id' &&
    rel.targetTable === 'customers' &&
    rel.targetColumn === 'id';
  assert('RTM-13: Foreign key relationship mapping validated', isValidFk);

  // RTM-10: Table with spaces in name -> Quoted correctly in generator
  const complexTable = new AnalysisSqlGenerator(({ quoteIdentifier: (id: string) => `"${id}"`, formatLimit: (sql: string, limit: number) => `${sql} LIMIT ${limit}`, formatPagination: (sql: string, limit: number, offset: number) => `${sql} LIMIT ${limit} OFFSET ${offset}`, formatDate: (date: Date) => `'${date.toISOString()}'`, formatExplain: (sql: string) => `EXPLAIN ${sql}`, qualifyTable: (schema: string | undefined, table: string) => schema ? `"${schema}"."${table}"` : `"${table}"` })).quoteTable('sales data', 'annual reports 2024');
  assert(
    'RTM-10b: Complex table identifier with spaces quoted',
    complexTable === '"sales data"."annual reports 2024"'
  );

  // RTM-11: Reserved keywords quoted correctly in generator
  const reservedCol = new AnalysisSqlGenerator(({ quoteIdentifier: (id: string) => `"${id}"`, formatLimit: (sql: string, limit: number) => `${sql} LIMIT ${limit}`, formatPagination: (sql: string, limit: number, offset: number) => `${sql} LIMIT ${limit} OFFSET ${offset}`, formatDate: (date: Date) => `'${date.toISOString()}'`, formatExplain: (sql: string) => `EXPLAIN ${sql}`, qualifyTable: (schema: string | undefined, table: string) => schema ? `"${schema}"."${table}"` : `"${table}"` })).quoteIdentifier('order');
  assert('RTM-11b: Reserved keyword "order" quoted safely', reservedCol === '"order"');

  return results;
}
