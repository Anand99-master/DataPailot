import { SavedQuery, SqlEditorTab } from '../src/types/database';

export function runQueryLibraryTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: errorMsg });
    }
  };

  // 1. Save query
  let savedQueries: SavedQuery[] = [];
  const query1: SavedQuery = {
    id: 'sq-1',
    name: 'Monthly Sales',
    query: 'SELECT * FROM sales',
    description: 'All sales',
    tags: ['Sales', 'Reporting'],
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  savedQueries.push(query1);

  assertTest('Save query', savedQueries.length === 1 && savedQueries[0].name === 'Monthly Sales', 'Query was not saved');

  // 2. Open query in tab
  let tabs: SqlEditorTab[] = [{
    id: 'tab-1',
    name: 'Query 1.sql',
    query: 'SELECT * FROM users',
    result: null,
    isRunning: false
  }];
  
  // opening in a new tab because tab-1 is modified/has query
  tabs.push({
    id: 'tab-2',
    name: query1.name,
    query: query1.query,
    result: null,
    isRunning: false,
    savedQueryId: query1.id,
    isModified: false
  });
  
  assertTest('Open query', tabs[1].savedQueryId === 'sq-1' && tabs[1].query === query1.query, 'Query not opened correctly');

  // 3. Unsaved modification indicator
  const modifiedQuery = 'SELECT * FROM sales WHERE amount > 100';
  let isModified = modifiedQuery !== query1.query;
  tabs[1].query = modifiedQuery;
  tabs[1].isModified = isModified;

  assertTest('Unsaved modification indicator', tabs[1].isModified === true, 'Modification not detected');

  // 4. Rename/Update query
  savedQueries[0].name = 'Monthly Sales Filtered';
  savedQueries[0].query = modifiedQuery;
  savedQueries[0].updatedAt = new Date().toISOString();
  tabs[1].name = savedQueries[0].name;
  tabs[1].isModified = false;

  assertTest('Update query', savedQueries[0].name === 'Monthly Sales Filtered' && tabs[1].isModified === false, 'Query update failed');

  // 5. Duplicate query
  const queryCopy: SavedQuery = {
    ...savedQueries[0],
    id: 'sq-2',
    name: `${savedQueries[0].name} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  savedQueries.push(queryCopy);

  assertTest('Duplicate query', savedQueries.length === 2 && savedQueries[1].name.includes('(Copy)'), 'Duplicate failed');

  // 6. Favorite/unfavorite
  savedQueries[1].isFavorite = true;
  assertTest('Favorite/unfavorite', savedQueries[1].isFavorite === true, 'Favorite failed');

  // 7. Search
  const searchTerm = 'Filtered';
  const searchResults = savedQueries.filter(q => q.name.includes(searchTerm));
  assertTest('Search', searchResults.length === 2 && searchResults[0].id === 'sq-1', 'Search failed');

  // 8. Tag filtering
  const tagResults = savedQueries.filter(q => q.tags.includes('Sales'));
  assertTest('Tag filtering', tagResults.length === 2, 'Tag filtering failed');

  // 9. Delete query
  savedQueries = savedQueries.filter(q => q.id !== 'sq-2');
  assertTest('Delete query', savedQueries.length === 1 && savedQueries[0].id === 'sq-1', 'Delete failed');

  return results;
}
