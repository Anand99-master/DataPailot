import { DiscoveredTable, TableDetailsResult } from '../types/database';

export interface Suggestion {
  name: string;
  type: 'keyword' | 'function' | 'table' | 'column' | 'alias';
  detail?: string;
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
  'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'WITH', 'AS', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'UNION ALL', 'EXISTS', 'IN', 'BETWEEN', 'LIKE',
  'ILIKE', 'IS NULL', 'IS NOT NULL', 'AND', 'OR', 'NOT', 'ASC', 'DESC'
];

const SQL_FUNCTIONS = [
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'COALESCE', 'NULLIF', 'CAST',
  'DATE_TRUNC', 'EXTRACT', 'CURRENT_DATE', 'CURRENT_TIMESTAMP',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD'
];

function extractAliases(sql: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  const fromJoinRegex = /(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)(?:\s+AS)?\s+([a-zA-Z0-9_]+)(?:\s|ON|WHERE|GROUP|ORDER|LIMIT|$)/gi;
  let match;
  while ((match = fromJoinRegex.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    const alias = match[2];
    if (alias && alias.toLowerCase() !== 'on' && alias.toLowerCase() !== 'where' && alias.toLowerCase() !== 'group' && alias.toLowerCase() !== 'order' && alias.toLowerCase() !== 'limit') {
      aliases[alias.toLowerCase()] = tableName;
    }
  }
  return aliases;
}

export function getSuggestions(
  sql: string,
  cursorPosition: number,
  tables: DiscoveredTable[],
  tableDetailsCache: Record<string, TableDetailsResult>
): { suggestions: Suggestion[]; prefix: string; filterText: string } {
  if (!tables) tables = [];
  
  const textBefore = sql.substring(0, cursorPosition);
  const match = textBefore.match(/([a-zA-Z0-9_.]+)$/);
  const currentWord = match ? match[1] : '';
  
  const isDotCompletion = currentWord.includes('.');
  let filterText = currentWord;
  let prefix = '';
  
  let suggestions: Suggestion[] = [];
  const aliases = extractAliases(sql);
  
  
  if (isDotCompletion) {
    const parts = currentWord.split('.');
    const objectName = parts[0].toLowerCase();
    filterText = parts[1] || '';
    prefix = objectName + '.';
    
    let targetTableName = objectName;
    if (aliases[objectName]) {
      targetTableName = aliases[objectName];
    }
    
    const cachedKeys = Object.keys(tableDetailsCache);
    const tableKey = cachedKeys.find(k => k.split('.')[1].toLowerCase() === targetTableName);
    
    if (tableKey && tableDetailsCache[tableKey]) {
      tableDetailsCache[tableKey].columns.forEach(c => {
        suggestions.push({ name: c.name, type: 'column', detail: c.dataType });
      });
    }
  } else {
    // Determine context based on the last major SQL keyword
    const contextMatch = textBefore.match(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|ON)\b(?![^]*\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|ON)\b)/i);
    const contextKeyword = contextMatch ? contextMatch[1].toUpperCase() : '';

    const suggestTables = ['FROM', 'JOIN'].includes(contextKeyword);
    const suggestColumns = ['SELECT', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'ON'].includes(contextKeyword);
    
    if (suggestTables) {
      tables.forEach(t => suggestions.push({ name: t.name, type: 'table', detail: t.schema }));
      SQL_KEYWORDS.forEach(kw => suggestions.push({ name: kw, type: 'keyword' }));
    } else if (suggestColumns) {
      Object.keys(aliases).forEach(al => suggestions.push({ name: al, type: 'alias', detail: aliases[al] }));
      Object.values(tableDetailsCache).forEach(details => {
         details.columns.forEach(c => {
             suggestions.push({ name: c.name, type: 'column', detail: `${details.name}.${c.name}` });
         });
      });
      tables.forEach(t => suggestions.push({ name: t.name, type: 'table', detail: t.schema })); // Sometimes users use table name instead of alias
      SQL_FUNCTIONS.forEach(fn => suggestions.push({ name: fn, type: 'function' }));
      SQL_KEYWORDS.forEach(kw => suggestions.push({ name: kw, type: 'keyword' }));
    } else {
      // Default: everything
      SQL_KEYWORDS.forEach(kw => suggestions.push({ name: kw, type: 'keyword' }));
      SQL_FUNCTIONS.forEach(fn => suggestions.push({ name: fn, type: 'function' }));
      tables.forEach(t => suggestions.push({ name: t.name, type: 'table', detail: t.schema }));
      Object.keys(aliases).forEach(al => suggestions.push({ name: al, type: 'alias', detail: aliases[al] }));
    }
  }

  // Filter and deduplicate
  if (filterText) {
    suggestions = suggestions.filter(s => s.name.toLowerCase().startsWith(filterText.toLowerCase()));
  }
  
  // Table relation suggestions
  // If the last word was JOIN, we can boost tables that have relationships with the current tables
  const isJoinContext = textBefore.match(/\bJOIN\s+[a-zA-Z0-9_]*$/i);
  let relatedTables = new Set<string>();
  if (isJoinContext) {
    // find tables currently in query
    const tableMatches = textBefore.match(/(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)/gi);
    if (tableMatches) {
        const tableNames = tableMatches.map(t => t.split(/\s+/)[1].toLowerCase());
        tableNames.forEach(tn => {
           const cachedKeys = Object.keys(tableDetailsCache);
           const tKey = cachedKeys.find(k => k.split('.')[1].toLowerCase() === tn);
           if (tKey && tableDetailsCache[tKey]) {
               const details = tableDetailsCache[tKey];
               details.outgoingRelationships.forEach(r => relatedTables.add(r.targetTable.toLowerCase()));
               details.incomingRelationships.forEach(r => relatedTables.add(r.sourceTable.toLowerCase()));
           }
        });
    }
  }

  // Dedup
  const seen = new Set();
  suggestions = suggestions.filter(s => {
      const key = `${s.type}-${s.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
  });
  
  // Sort: Columns > Aliases > Tables > Functions > Keywords
  const typeWeight = { column: 1, alias: 2, table: 3, function: 4, keyword: 5 };
  suggestions.sort((a, b) => {
      if (a.type === 'table' && b.type === 'table') {
          const aRelated = relatedTables.has(a.name.toLowerCase());
          const bRelated = relatedTables.has(b.name.toLowerCase());
          if (aRelated && !bRelated) return -1;
          if (!aRelated && bRelated) return 1;
      }
      if (typeWeight[a.type] !== typeWeight[b.type]) return typeWeight[a.type] - typeWeight[b.type];
      return a.name.localeCompare(b.name);
  });

  return { suggestions: suggestions.slice(0, 50), prefix, filterText };
}
