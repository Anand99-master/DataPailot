export interface SqlDialect {
  quoteIdentifier(identifier: string): string;
  formatLimit(sql: string, limit: number): string;
  formatPagination(sql: string, limit: number, offset: number): string;
  formatDate(date: Date): string;
  formatExplain(sql: string): string;
  qualifyTable(schema: string | undefined, table: string): string;
}
