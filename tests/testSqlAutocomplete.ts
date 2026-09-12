import { getSuggestions, Suggestion } from '../src/utils/sqlAutocomplete';
import { DiscoveredTable, TableDetailsResult } from '../src/types/database';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runSqlAutocompleteTests() {
  const results = [];
  const assertTest = (name, condition, errorMsg) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e) {
      results.push({ name, passed: false, error: e.message });
    }
  };
  console.log('Running SQL Autocomplete Tests...');

  const mockTables: DiscoveredTable[] = [
    { schema: 'public', name: 'users', type: 'BASE TABLE' },
    { schema: 'public', name: 'orders', type: 'BASE TABLE' }
  ];

  const mockCache: Record<string, TableDetailsResult> = {
    'public.users': {
      schema: 'public',
      name: 'users',
      type: 'BASE TABLE',
      columnCount: 2,
      columns: [
        { name: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'username', dataType: 'text', isNullable: false, isPrimaryKey: false, isForeignKey: false }
      ],
      outgoingRelationships: [],
      incomingRelationships: [
        { constraintName: 'fk_user', sourceSchema: 'public', sourceTable: 'orders', sourceColumn: 'user_id', targetSchema: 'public', targetTable: 'users', targetColumn: 'id' }
      ]
    },
    'public.orders': {
      schema: 'public',
      name: 'orders',
      type: 'BASE TABLE',
      columnCount: 2,
      columns: [
        { name: 'order_id', dataType: 'integer', isNullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'user_id', dataType: 'integer', isNullable: false, isPrimaryKey: false, isForeignKey: true }
      ],
      outgoingRelationships: [
        { constraintName: 'fk_user', sourceSchema: 'public', sourceTable: 'orders', sourceColumn: 'user_id', targetSchema: 'public', targetTable: 'users', targetColumn: 'id' }
      ],
      incomingRelationships: []
    }
  };

  // 1. Table autocomplete
  let res = getSuggestions('SELECT * FROM u', 15, mockTables, mockCache);
  assertTest('Table autocomplete', res.suggestions.some(s => s.name === 'users' && s.type === 'table'), 'Should suggest users table');
  
  // 2. Keyword completion
  res = getSuggestions('SEL', 3, mockTables, mockCache);
  assertTest('Keyword completion', res.suggestions.some(s => s.name === 'SELECT' && s.type === 'keyword'), 'Should suggest SELECT keyword');

  // 3. Alias autocomplete & Column autocomplete & Dot completion
  const sql = 'SELECT u. FROM users u';
  res = getSuggestions(sql, 9, mockTables, mockCache);
  assertTest('Alias autocomplete & Column autocomplete', res.suggestions.some(s => s.name === 'username' && s.type === 'column'), 'Should suggest username for alias u');

  // 4. Function completion
  res = getSuggestions('SELECT COU', 10, mockTables, mockCache);
  assertTest('Function completion', res.suggestions.some(s => s.name === 'COUNT' && s.type === 'function'), 'Should suggest COUNT function');

  // 5. JOIN relationship suggestions
  const joinSql = 'SELECT * FROM users u JOIN o';
  res = getSuggestions(joinSql, 28, mockTables, mockCache);
  const firstTableSuggestion = res.suggestions.find(s => s.type === 'table');
  assertTest('JOIN relationship suggestions', firstTableSuggestion?.name === 'orders', 'Should suggest orders table first due to FK relationship');

  // 6. Unknown table/column not being suggested
  res = getSuggestions('SELECT * FROM z', 15, mockTables, mockCache);
  assertTest('Unknown table/column not being suggested', !res.suggestions.some(s => s.name === 'z_table'), 'Should not suggest unknown tables');

  return results;
}


