const fs = require('fs');
let content = fs.readFileSync('src/utils/sqlAutocomplete.ts', 'utf8');

// We need to implement table relation suggestions:
// After JOIN, we look at the last table mentioned or the first table in FROM,
// and prioritize tables that have relationships with it.

const newLogic = `
  // Filter and deduplicate
  if (filterText) {
    suggestions = suggestions.filter(s => s.name.toLowerCase().startsWith(filterText.toLowerCase()));
  }
  
  // Table relation suggestions
  // If the last word was JOIN, we can boost tables that have relationships with the current tables
  const isJoinContext = textBefore.match(/\\bJOIN\\s+[a-zA-Z0-9_]*$/i);
  let relatedTables = new Set<string>();
  if (isJoinContext) {
    // find tables currently in query
    const tableMatches = textBefore.match(/(?:FROM|JOIN)\\s+([a-zA-Z0-9_]+)/gi);
    if (tableMatches) {
        const tableNames = tableMatches.map(t => t.split(/\\s+/)[1].toLowerCase());
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
      const key = \`\${s.type}-\${s.name}\`;
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
`;

content = content.replace(
  /\/\/ Filter and deduplicate[\s\S]*return \{ suggestions: suggestions\.slice\(0, 50\), prefix, filterText \};/,
  newLogic + '\n  return { suggestions: suggestions.slice(0, 50), prefix, filterText };'
);

fs.writeFileSync('src/utils/sqlAutocomplete.ts', content);
