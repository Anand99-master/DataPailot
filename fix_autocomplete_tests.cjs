const fs = require('fs');
let content = fs.readFileSync('tests/testSqlAutocomplete.ts', 'utf8');
content = content.replace(
  "function runTests() {",
  "export function runSqlAutocompleteTests() {\n  const results = [];\n  const assertTest = (name, condition, errorMsg) => {\n    try {\n      assert(condition, errorMsg);\n      results.push({ name, passed: true });\n    } catch (e) {\n      results.push({ name, passed: false, error: e.message });\n    }\n  };"
);

content = content.replace(
  "assert(res.suggestions.some(s => s.name === 'users' && s.type === 'table'), 'Should suggest users table');",
  "assertTest('Table autocomplete', res.suggestions.some(s => s.name === 'users' && s.type === 'table'), 'Should suggest users table');"
);

content = content.replace(
  "assert(res.suggestions.some(s => s.name === 'SELECT' && s.type === 'keyword'), 'Should suggest SELECT keyword');",
  "assertTest('Keyword completion', res.suggestions.some(s => s.name === 'SELECT' && s.type === 'keyword'), 'Should suggest SELECT keyword');"
);

content = content.replace(
  "assert(res.suggestions.some(s => s.name === 'username' && s.type === 'column'), 'Should suggest username for alias u');",
  "assertTest('Alias autocomplete & Column autocomplete', res.suggestions.some(s => s.name === 'username' && s.type === 'column'), 'Should suggest username for alias u');"
);

content = content.replace(
  "assert(res.suggestions.some(s => s.name === 'COUNT' && s.type === 'function'), 'Should suggest COUNT function');",
  "assertTest('Function completion', res.suggestions.some(s => s.name === 'COUNT' && s.type === 'function'), 'Should suggest COUNT function');"
);

content = content.replace(
  "assert(firstTableSuggestion?.name === 'orders', 'Should suggest orders table first due to FK relationship');",
  "assertTest('JOIN relationship suggestions', firstTableSuggestion?.name === 'orders', 'Should suggest orders table first due to FK relationship');"
);

content = content.replace(
  "assert(!res.suggestions.some(s => s.name === 'z_table'), 'Should not suggest unknown tables');",
  "assertTest('Unknown table/column not being suggested', !res.suggestions.some(s => s.name === 'z_table'), 'Should not suggest unknown tables');"
);

content = content.replace(
  "console.log('SQL Autocomplete Tests Passed!');\n}",
  "return results;\n}"
);

content = content.replace("runTests();", "");

fs.writeFileSync('tests/testSqlAutocomplete.ts', content);
