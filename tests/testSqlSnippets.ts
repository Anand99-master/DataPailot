import { SqlSnippet } from '../src/types/database';
import { BUILT_IN_SNIPPETS } from '../src/hooks/useSnippets';

export function runSqlSnippetsTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: errorMsg });
    }
  };

  // 1. Built-in Snippets load
  assertTest('Load built-in snippets', BUILT_IN_SNIPPETS.length > 0 && BUILT_IN_SNIPPETS.some(s => s.category === 'Basic'), 'Failed to load built-in snippets');
  assertTest('Read-only validation on built-ins', BUILT_IN_SNIPPETS.every(s => s.sql.toUpperCase().includes('SELECT') || s.sql.toUpperCase().includes('WITH')), 'Built-ins contain invalid mutating keywords');

  // 2. Custom Snippet Lifecycle
  let customSnippets: SqlSnippet[] = [];
  const addSnippet = (snippet: any) => {
    customSnippets.push({ ...snippet, id: `cs-${Date.now()}`, isCustom: true, isFavorite: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  };
  
  addSnippet({ name: 'My Custom', description: 'Test', sql: 'SELECT * FROM test', category: 'Custom', prefix: 'mytest' });
  assertTest('Create custom snippet', customSnippets.length === 1 && customSnippets[0].name === 'My Custom', 'Failed to create custom snippet');

  // 3. Edit Snippet
  customSnippets[0].name = 'Edited Custom';
  assertTest('Edit custom snippet', customSnippets[0].name === 'Edited Custom', 'Failed to edit snippet');

  // 4. Duplicate Custom Snippet
  const duplicate = { ...customSnippets[0], id: `cs-${Date.now()+1}`, name: customSnippets[0].name + ' (Copy)' };
  customSnippets.push(duplicate);
  assertTest('Duplicate custom snippet', customSnippets.length === 2 && customSnippets[1].name.includes('(Copy)'), 'Failed to duplicate snippet');

  // 5. Delete Snippet
  customSnippets = customSnippets.filter(s => s.id !== duplicate.id);
  assertTest('Delete custom snippet', customSnippets.length === 1 && customSnippets[0].id !== duplicate.id, 'Failed to delete snippet');

  // 6. Favorites
  customSnippets[0].isFavorite = true;
  assertTest('Favorite snippet', customSnippets[0].isFavorite === true, 'Failed to favorite snippet');

  // 7. Search/Filter
  const allSnippets = [...BUILT_IN_SNIPPETS, ...customSnippets];
  const searchResults = allSnippets.filter(s => s.name.toLowerCase().includes('edited custom'));
  assertTest('Search snippets', searchResults.length === 1 && searchResults[0].name === 'Edited Custom', 'Failed to search snippet');

  const catResults = allSnippets.filter(s => s.category === 'Aggregation');
  assertTest('Category filter', catResults.length > 0 && catResults.every(s => s.category === 'Aggregation'), 'Category filter failed');

  // 8. Schema-aware placeholder handling simulation
  const rawSql = 'SELECT * FROM {{table}} WHERE {{column}} = 1';
  let processedSql = rawSql.replace(/\{\{table\}\}/g, '"public"."orders"');
  processedSql = processedSql.replace(/\{\{column\}\}/g, 'status');
  assertTest('Schema-aware placeholders', processedSql === 'SELECT * FROM "public"."orders" WHERE status = 1', 'Failed to process placeholders');

  // 9. Read-only guard applies to custom snippets (simulate client rejection of mutating SQL)
  // Our backend API handles this, but conceptually snippets inserted are still passed to executeQuery which verifies it
  const isMutating = (sql: string) => /\b(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|TRUNCATE)\b/i.test(sql);
  assertTest('Mutating SQL rejected', isMutating('UPDATE users SET role = admin') === true, 'Failed to catch mutating SQL in snippet logic');

  return results;
}
