import { tokenizeSql, getSqlTokenColorClass, SqlToken } from '../src/utils/sqlHighlighter';
import { DiscoveredTable } from '../src/types/database';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runSqlSyntaxHighlighterTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('--- 28. SQL SYNTAX HIGHLIGHTING & TOKEN ENGINE TESTS ---');

  const mockTables: DiscoveredTable[] = [
    { schema: 'public', name: 'customers', type: 'BASE TABLE' },
    { schema: 'public', name: 'orders', type: 'BASE TABLE' },
    { schema: 'public', name: 'products', type: 'BASE TABLE' }
  ];

  // 1. Basic Query Keywords, Table, Operator, and Number
  const query1 = `SELECT * FROM "customers" WHERE age > 25 ORDER BY customer_name LIMIT 50;`;
  const tokens1 = tokenizeSql(query1, { tables: mockTables });
  
  assertTest(
    '1. Keywords tokenized (SELECT, FROM, WHERE, ORDER BY, LIMIT)',
    tokens1.some(t => t.text === 'SELECT' && t.type === 'keyword') &&
    tokens1.some(t => t.text === 'FROM' && t.type === 'keyword') &&
    tokens1.some(t => t.text === 'WHERE' && t.type === 'keyword') &&
    tokens1.some(t => t.text === 'ORDER BY' && t.type === 'keyword') &&
    tokens1.some(t => t.text === 'LIMIT' && t.type === 'keyword'),
    'Major keywords must have type keyword'
  );

  assertTest(
    '2. Quoted table identifier classified as table',
    tokens1.some(t => t.text === '"customers"' && t.type === 'table'),
    'Quoted table "customers" should be classified as table'
  );

  assertTest(
    '3. Numeric literals classified as number',
    tokens1.some(t => t.text === '25' && t.type === 'number') &&
    tokens1.some(t => t.text === '50' && t.type === 'number'),
    'Numbers 25 and 50 must have type number'
  );

  assertTest(
    '4. Comparison operators and asterisks classified as operator',
    tokens1.some(t => t.text === '*' && t.type === 'operator') &&
    tokens1.some(t => t.text === '>' && t.type === 'operator'),
    'Operators * and > must have type operator'
  );

  // 2. Complex User Query with Aggregations, Joins, Aliases, and Grouping
  const query2 = `SELECT
    c.customer_name,
    COUNT(o.order_id) AS order_count
FROM customers c
LEFT JOIN orders o
    ON c.customer_id = o.customer_id
GROUP BY c.customer_name
ORDER BY order_count DESC
LIMIT 10;`;
  const tokens2 = tokenizeSql(query2, { tables: mockTables });

  assertTest(
    '5. Function COUNT() classified as function',
    tokens2.some(t => t.text === 'COUNT' && t.type === 'function'),
    'COUNT function must be classified as function'
  );

  assertTest(
    '6. Multi-word keywords LEFT JOIN and GROUP BY classified as keyword',
    tokens2.some(t => t.text === 'LEFT JOIN' && t.type === 'keyword') &&
    tokens2.some(t => t.text === 'GROUP BY' && t.type === 'keyword'),
    'LEFT JOIN and GROUP BY must be classified as keyword'
  );

  assertTest(
    '7. AS alias (order_count) classified as alias',
    tokens2.some(t => t.text === 'order_count' && t.type === 'alias'),
    'AS order_count must classify order_count as alias'
  );

  assertTest(
    '8. Table aliases (c and o) classified as alias',
    tokens2.some(t => t.text === 'c' && t.type === 'alias') &&
    tokens2.some(t => t.text === 'o' && t.type === 'alias'),
    'FROM customers c and LEFT JOIN orders o must classify c and o as aliases'
  );

  // 3. String literals and comments
  const query3 = `-- Single-line comment
/*
   Multi-line
   block comment
*/
SELECT 'Surat' AS city, 'Gujarat' AS state, total_spent
FROM customers
WHERE city = 'Surat' AND status = 'Active';`;
  const tokens3 = tokenizeSql(query3, { tables: mockTables });

  assertTest(
    '9. Single-line and Multi-line comments classified as comment',
    tokens3.some(t => t.text.includes('Single-line comment') && t.type === 'comment') &&
    tokens3.some(t => t.text.includes('Multi-line') && t.type === 'comment'),
    'Comments must be classified as comment'
  );

  assertTest(
    '10. Single-quoted strings classified as string',
    tokens3.some(t => t.text === "'Surat'" && t.type === 'string') &&
    tokens3.some(t => t.text === "'Gujarat'" && t.type === 'string') &&
    tokens3.some(t => t.text === "'Active'" && t.type === 'string'),
    'Strings must have type string'
  );

  // 4. Dialect Specific Syntax Tests
  // 4a. PostgreSQL: ::typecast, $$dollar-quote$$, ILIKE
  const pgSql = `SELECT name::text, $$dollar quote$$ AS dq FROM customers WHERE name ILIKE 'alex%';`;
  const pgTokens = tokenizeSql(pgSql, { dialect: 'postgresql', tables: mockTables });
  assertTest(
    '11. PostgreSQL :: typecast and $$ string tokens',
    pgTokens.some(t => t.text === '::' && t.type === 'operator') &&
    pgTokens.some(t => t.text === '$$dollar quote$$' && t.type === 'string') &&
    pgTokens.some(t => t.text === 'ILIKE' && t.type === 'keyword'),
    'PostgreSQL :: and $$ must be recognized correctly'
  );

  // 4b. MySQL: `backtick`, # comment, @variable
  const mySql = `SELECT \`customer_name\`, @row_num := @row_num + 1 FROM \`customers\`; # MySQL comment`;
  const myTokens = tokenizeSql(mySql, { dialect: 'mysql', tables: mockTables });
  assertTest(
    '12. MySQL backticks, @variables, and # comments',
    myTokens.some(t => t.text === '`customers`' && t.type === 'table') &&
    myTokens.some(t => t.text === '@row_num' && t.type === 'variable') &&
    myTokens.some(t => t.text.includes('MySQL comment') && t.type === 'comment'),
    'MySQL backticks, @variable, and # comments must be recognized'
  );

  // 4c. SQL Server: [brackets], @param, TOP
  const tsql = `SELECT TOP 10 [customer_id], [customer_name] FROM [customers] WHERE [customer_id] = @target_id;`;
  const tsqlTokens = tokenizeSql(tsql, { dialect: 'sqlserver', tables: mockTables });
  assertTest(
    '13. SQL Server [brackets], @param, and TOP keyword',
    tsqlTokens.some(t => t.text === 'TOP' && t.type === 'keyword') &&
    tsqlTokens.some(t => t.text === '[customers]' && t.type === 'table') &&
    tsqlTokens.some(t => t.text === '@target_id' && t.type === 'variable'),
    'SQL Server bracketed identifiers, variables, and TOP must be recognized'
  );

  // 4d. Oracle: ROWNUM, :bind_param
  const oracleSql = `SELECT customer_name FROM customers WHERE ROWNUM <= 50 AND customer_id = :cid;`;
  const oracleTokens = tokenizeSql(oracleSql, { dialect: 'oracle', tables: mockTables });
  assertTest(
    '14. Oracle ROWNUM and :bind_param',
    oracleTokens.some(t => t.text === 'ROWNUM' && t.type === 'keyword') &&
    oracleTokens.some(t => t.text === ':cid' && t.type === 'variable'),
    'Oracle ROWNUM and bind parameters must be recognized'
  );

  // 5. Token Color Class mappings (Accessibility & Design Standards)
  assertTest(
    '15. High-contrast accessible color class assignments',
    getSqlTokenColorClass('keyword').includes('text-sky-400') &&
    getSqlTokenColorClass('function').includes('text-purple-400') &&
    getSqlTokenColorClass('table').includes('text-emerald-400') &&
    getSqlTokenColorClass('alias').includes('text-teal-300') &&
    getSqlTokenColorClass('string').includes('text-amber-300') &&
    getSqlTokenColorClass('number').includes('text-orange-400') &&
    getSqlTokenColorClass('comment').includes('text-slate-500') &&
    getSqlTokenColorClass('operator').includes('text-rose-400'),
    'Token types must map to distinct, professional dark-theme colors'
  );

  return results;
}
