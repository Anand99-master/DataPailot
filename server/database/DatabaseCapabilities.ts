export interface DatabaseCapabilities {
  transactions: boolean;
  explain: boolean;
  cancelQuery: boolean;
  schemas: boolean;
  foreignKeys: boolean;
  indexes: boolean;
  windowFunctions: boolean;
  dateFunctions: boolean;
  jsonFunctions: boolean;
  returning: boolean;
  limitSyntax: 'LIMIT' | 'TOP' | 'FETCH' | 'ROWNUM';
}
