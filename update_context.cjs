const fs = require('fs');
let content = fs.readFileSync('src/utils/sqlAutocomplete.ts', 'utf8');

const replacement = `
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
    const contextMatch = textBefore.match(/\\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|ON)\\b(?![^]*\\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|ON)\\b)/i);
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
             suggestions.push({ name: c.name, type: 'column', detail: \`\${details.name}.\${c.name}\` });
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
`;

content = content.replace(/if \(isDotCompletion\) \{[\s\S]*?\}\s*\}\s*\/\/\s*Filter and deduplicate/, replacement + '\n  // Filter and deduplicate');

fs.writeFileSync('src/utils/sqlAutocomplete.ts', content);
