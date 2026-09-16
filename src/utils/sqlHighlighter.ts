/**
 * Professional SQL Syntax Highlighting Engine for DataPilot SQL Editor.
 *
 * Supports PostgreSQL, SQLite, MySQL, SQL Server (T-SQL), and Oracle dialects.
 * Accurately differentiates:
 * - Keywords (SELECT, FROM, WHERE, JOIN, GROUP BY, ORDER BY, LIMIT, CASE, etc.)
 * - Functions (COUNT(), SUM(), AVG(), DATE_TRUNC(), COALESCE(), custom functions, etc.)
 * - Table names (quoted "customers", `customers`, [customers], or schema tables)
 * - Columns / Identifiers (customer_id, customer_name, dotted identifiers c.name)
 * - Aliases (AS order_count, table aliases c, o)
 * - String literals ('Surat', 'Gujarat', $$postgres$$)
 * - Numeric literals (50, 100, 3.14, 0.5, 1e5)
 * - Comments (-- single line, # mysql style, multiline comments)
 * - Operators (=, >, <, >=, <=, <>, !=, +, -, *, /, %, ||, ::, ->, ->>)
 * - Punctuation ((, ), ,, ;, .)
 * - Variables / Parameters (:param, @var, $1, ?)
 */

import { DiscoveredTable, TableDetailsResult } from '../types/database';

export type SqlTokenType =
  | 'keyword'
  | 'function'
  | 'table'
  | 'column'
  | 'alias'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'variable'
  | 'identifier'
  | 'plain';

export interface SqlToken {
  type: SqlTokenType;
  text: string;
}

// Comprehensive SQL Keywords across PostgreSQL, SQLite, MySQL, SQL Server, Oracle
export const SQL_KEYWORDS_SET = new Set([
  // Core Query & Clauses
  'SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'FIRST', 'NEXT',
  'ROWS', 'ROW', 'ONLY', 'DISTINCT', 'ALL', 'UNION', 'EXCEPT', 'INTERSECT', 'MINUS',
  'WITH', 'RECURSIVE', 'AS', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'NOT NULL',
  'TRUE', 'FALSE', 'BOOLEAN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ON', 'USING',
  'EXISTS', 'BETWEEN', 'LIKE', 'ILIKE', 'SIMILAR', 'REGEXP', 'RLIKE', 'ESCAPE',
  'ASC', 'DESC', 'NULLS', 'OVER', 'PARTITION', 'WINDOW', 'FILTER', 'WITHIN',
  
  // Joins
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'NATURAL', 'APPLY',
  
  // Grouping & Ordering
  'GROUP', 'ORDER', 'BY',
  
  // DML & Mutations
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'MERGE', 'MATCHED',
  'RETURNING', 'OUTPUT', 'TRUNCATE', 'DEFAULT',
  
  // DDL & Schema Objects
  'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW', 'INDEX', 'SCHEMA', 'DATABASE',
  'COLUMN', 'CONSTRAINT', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CHECK',
  'UNIQUE', 'CASCADE', 'RESTRICT', 'TEMPORARY', 'TEMP', 'IF',
  
  // Dialect specific keywords
  'TOP', 'ROWNUM', 'CONNECT', 'START', 'PRIOR', 'AUTOINCREMENT', 'AUTO_INCREMENT',
  'IDENTITY', 'GENERATED', 'ALWAYS', 'STORED', 'VIRTUAL', 'COLLATE', 'EXPLAIN',
  'ANALYZE', 'VACUUM', 'PRAGMA', 'SHOW', 'DESCRIBE', 'USE',
  
  // Common Data Types
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'VARCHAR', 'NVARCHAR',
  'CHAR', 'NCHAR', 'TEXT', 'NUMERIC', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL',
  'BOOLEAN', 'BOOL', 'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL',
  'JSON', 'JSONB', 'XML', 'BLOB', 'CLOB', 'BYTEA', 'UUID', 'SERIAL', 'BIGSERIAL'
]);

// SQL Multi-word keyword phrases for accurate token recognition
const MULTI_WORD_KEYWORDS = [
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'NATURAL JOIN', 'OUTER APPLY', 'CROSS APPLY',
  'GROUP BY', 'ORDER BY', 'PARTITION BY', 'UNION ALL', 'IS NOT NULL', 'IS NULL',
  'NOT IN', 'NOT LIKE', 'NOT ILIKE', 'NOT BETWEEN', 'NOT EXISTS', 'PRIMARY KEY',
  'FOREIGN KEY', 'INSERT INTO', 'DELETE FROM', 'SIMILAR TO', 'NULLS FIRST', 'NULLS LAST',
  'ROWS ONLY', 'ROW ONLY', 'FETCH NEXT', 'FETCH FIRST', 'GENERATED ALWAYS', 'START WITH',
  'CONNECT BY'
];

// Comprehensive Built-in Functions across dialects
export const SQL_FUNCTIONS_SET = new Set([
  // Aggregates
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ARRAY_AGG', 'STRING_AGG', 'GROUP_CONCAT',
  'LISTAGG', 'JSON_AGG', 'JSONB_AGG', 'JSON_OBJECTAGG', 'JSONB_OBJECTAGG', 'STATS_MODE',
  
  // Math & Numeric
  'ROUND', 'TRUNC', 'TRUNCATE', 'CEIL', 'CEILING', 'FLOOR', 'ABS', 'MOD', 'POWER',
  'POW', 'SQRT', 'EXP', 'LN', 'LOG', 'LOG10', 'SIGN', 'RANDOM', 'RAND', 'PI',
  
  // String Functions
  'CONCAT', 'CONCAT_WS', 'SUBSTR', 'SUBSTRING', 'LENGTH', 'LEN', 'CHAR_LENGTH',
  'CHARACTER_LENGTH', 'LOWER', 'UPPER', 'TRIM', 'LTRIM', 'RTRIM', 'BTRIM', 'REPLACE',
  'REVERSE', 'LPAD', 'RPAD', 'SPLIT_PART', 'POSITION', 'INSTR', 'STRPOS', 'FORMAT',
  'LEFT', 'RIGHT', 'REPEAT', 'INITCAP', 'TO_HEX', 'REGEXP_REPLACE', 'REGEXP_MATCH',
  
  // Date & Time Functions
  'DATE_TRUNC', 'EXTRACT', 'DATEADD', 'DATEDIFF', 'DATE_ADD', 'DATE_SUB', 'DATE_DIFF',
  'TO_DATE', 'TO_CHAR', 'TO_TIMESTAMP', 'NOW', 'CURRENT_DATE', 'CURRENT_TIME',
  'CURRENT_TIMESTAMP', 'LOCALTIME', 'LOCALTIMESTAMP', 'SYSDATE', 'SYSTIMESTAMP',
  'GETDATE', 'GETUTCDATE', 'DATEFROMPARTS', 'TIMEFROMPARTS', 'DATENAME', 'DATEPART',
  'AGE', 'MAKE_DATE', 'MAKE_TIME', 'MAKE_TIMESTAMP', 'STRFTIME',
  
  // Conditional, Casting & Null Handling
  'COALESCE', 'NULLIF', 'NVL', 'NVL2', 'IFNULL', 'ISNULL', 'IIF', 'DECODE',
  'GREATEST', 'LEAST', 'CAST', 'CONVERT', 'TRY_CAST', 'TRY_CONVERT', 'TYPEOF',
  
  // Window Functions
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'PERCENT_RANK', 'CUME_DIST', 'NTILE',
  'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
  
  // JSON & XML Functions
  'JSON_EXTRACT', 'JSON_VALUE', 'JSON_QUERY', 'JSON_ARRAY', 'JSON_OBJECT',
  'JSON_ARRAY_LENGTH', 'TO_JSON', 'TO_JSONB', 'ROW_TO_JSON', 'JSON_BUILD_OBJECT',
  'JSON_BUILD_ARRAY', 'JSON_EXTRACT_PATH'
]);

/**
 * Tokenize a SQL string into a sequence of classified tokens for syntax highlighting.
 */
export function tokenizeSql(
  sql: string,
  options?: {
    tables?: DiscoveredTable[];
    tableDetailsCache?: Record<string, TableDetailsResult>;
    dialect?: string;
  }
): SqlToken[] {
  if (!sql) return [];

  const knownTables = new Set<string>();
  if (options?.tables) {
    options.tables.forEach(t => {
      knownTables.add(t.name.toLowerCase());
    });
  }
  if (options?.tableDetailsCache) {
    Object.keys(options.tableDetailsCache).forEach(k => {
      const parts = k.split('.');
      if (parts.length > 1) {
        knownTables.add(parts[1].toLowerCase());
      } else {
        knownTables.add(k.toLowerCase());
      }
    });
  }

  const tokens: SqlToken[] = [];
  let i = 0;
  const len = sql.length;

  // Track recent tokens to detect contextual table names and aliases
  let prevSignificantTokenType: SqlTokenType | null = null;
  let prevSignificantWord: string | null = null;

  while (i < len) {
    const char = sql[i];
    const rest = sql.substring(i);

    // 1. Whitespace (preserve spaces and newlines exactly)
    if (/\s/.test(char)) {
      let ws = '';
      while (i < len && /\s/.test(sql[i])) {
        ws += sql[i];
        i++;
      }
      tokens.push({ type: 'plain', text: ws });
      continue;
    }

    // 2. Comments
    // 2a. Single-line comment: -- or # (MySQL)
    if (sql.startsWith('--', i) || char === '#') {
      let comment = '';
      while (i < len && sql[i] !== '\n' && sql[i] !== '\r') {
        comment += sql[i];
        i++;
      }
      tokens.push({ type: 'comment', text: comment });
      prevSignificantTokenType = 'comment';
      continue;
    }

    // 2b. Multi-line comment: /* ... */
    if (sql.startsWith('/*', i)) {
      const endIdx = sql.indexOf('*/', i + 2);
      if (endIdx !== -1) {
        const comment = sql.substring(i, endIdx + 2);
        tokens.push({ type: 'comment', text: comment });
        i = endIdx + 2;
      } else {
        // Unclosed block comment (user still typing)
        const comment = sql.substring(i);
        tokens.push({ type: 'comment', text: comment });
        i = len;
      }
      prevSignificantTokenType = 'comment';
      continue;
    }

    // 3. String Literals
    // 3a. Single-quoted strings: '...' (with '' or \' escape)
    if (char === "'") {
      let str = "'";
      i++;
      while (i < len) {
        if (sql[i] === "'") {
          if (i + 1 < len && sql[i + 1] === "'") {
            str += "''";
            i += 2;
          } else {
            str += "'";
            i++;
            break;
          }
        } else if (sql[i] === '\\' && i + 1 < len) {
          str += sql[i] + sql[i + 1];
          i += 2;
        } else {
          str += sql[i];
          i++;
        }
      }
      tokens.push({ type: 'string', text: str });
      prevSignificantTokenType = 'string';
      prevSignificantWord = null;
      continue;
    }

    // 3b. PostgreSQL Dollar-quoted strings: $$...$$ or $tag$...$tag$
    if (char === '$') {
      const dollarMatch = rest.match(/^\$([a-zA-Z0-9_]*)\$/);
      if (dollarMatch) {
        const tag = dollarMatch[0];
        const endTagIdx = sql.indexOf(tag, i + tag.length);
        if (endTagIdx !== -1) {
          const str = sql.substring(i, endTagIdx + tag.length);
          tokens.push({ type: 'string', text: str });
          i = endTagIdx + tag.length;
        } else {
          const str = sql.substring(i);
          tokens.push({ type: 'string', text: str });
          i = len;
        }
        prevSignificantTokenType = 'string';
        prevSignificantWord = null;
        continue;
      }
    }

    // 4. Quoted Identifiers / Table Names
    // 4a. Double-quoted: "customers", "order_id"
    if (char === '"') {
      let quoted = '"';
      i++;
      while (i < len) {
        if (sql[i] === '"') {
          if (i + 1 < len && sql[i + 1] === '"') {
            quoted += '""';
            i += 2;
          } else {
            quoted += '"';
            i++;
            break;
          }
        } else if (sql[i] === '\\' && i + 1 < len) {
          quoted += sql[i] + sql[i + 1];
          i += 2;
        } else {
          quoted += sql[i];
          i++;
        }
      }
      const rawName = quoted.slice(1, -1).toLowerCase();
      const isContextTable = prevSignificantWord && ['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE'].includes(prevSignificantWord);
      const isKnownTable = knownTables.has(rawName);
      
      tokens.push({
        type: isContextTable || isKnownTable ? 'table' : 'identifier',
        text: quoted
      });
      prevSignificantTokenType = isContextTable || isKnownTable ? 'table' : 'identifier';
      prevSignificantWord = null;
      continue;
    }

    // 4b. MySQL Backtick quoted: `customers`
    if (char === '`') {
      let quoted = '`';
      i++;
      while (i < len && sql[i] !== '`') {
        if (sql[i] === '\\' && i + 1 < len) {
          quoted += sql[i] + sql[i + 1];
          i += 2;
        } else {
          quoted += sql[i];
          i++;
        }
      }
      if (i < len && sql[i] === '`') {
        quoted += '`';
        i++;
      }
      tokens.push({ type: 'table', text: quoted });
      prevSignificantTokenType = 'table';
      prevSignificantWord = null;
      continue;
    }

    // 4c. SQL Server Bracket quoted: [customers]
    if (char === '[') {
      let bracketed = '[';
      i++;
      while (i < len && sql[i] !== ']') {
        bracketed += sql[i];
        i++;
      }
      if (i < len && sql[i] === ']') {
        bracketed += ']';
        i++;
      }
      tokens.push({ type: 'table', text: bracketed });
      prevSignificantTokenType = 'table';
      prevSignificantWord = null;
      continue;
    }

    // 5. Variables & Parameters
    // Positional params ($1, $2) or bind params (:param) or T-SQL / MySQL vars (@var, @@version) or ?
    if (char === ':' || char === '@' || char === '?' || (char === '$' && /^\$[0-9]+/.test(rest))) {
      // Check for PostgreSQL typecast ::
      if (sql.startsWith('::', i)) {
        tokens.push({ type: 'operator', text: '::' });
        i += 2;
        prevSignificantTokenType = 'operator';
        prevSignificantWord = '::';
        continue;
      }
      const varMatch = rest.match(/^(@{1,2}[a-zA-Z0-9_]+|:[a-zA-Z0-9_]+|\$[0-9]+|\?)/);
      if (varMatch) {
        tokens.push({ type: 'variable', text: varMatch[0] });
        i += varMatch[0].length;
        prevSignificantTokenType = 'variable';
        prevSignificantWord = null;
        continue;
      }
    }

    // 6. Numeric Literals
    // Hex: 0x1A, Binary: 0b101, Decimals/Floats: 50, 3.14, 0.5, 1e-4
    const numMatch = rest.match(/^(0x[0-9a-fA-F]+|0b[01]+|\d+(\.\d+)?([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)\b/);
    if (numMatch && (char >= '0' && char <= '9' || char === '.')) {
      tokens.push({ type: 'number', text: numMatch[0] });
      i += numMatch[0].length;
      prevSignificantTokenType = 'number';
      prevSignificantWord = null;
      continue;
    }

    // 7. Multi-character Operators & JSON Operators
    const opMatch = rest.match(/^(::|->>|->|#>>|#>|<=>|<>|!=|>=|<=|==|\|\||\.\.)/);
    if (opMatch) {
      tokens.push({ type: 'operator', text: opMatch[0] });
      i += opMatch[0].length;
      prevSignificantTokenType = 'operator';
      prevSignificantWord = opMatch[0];
      continue;
    }

    // 8. Single-character Operators
    if (['=', '>', '<', '+', '-', '*', '/', '%', '&', '|', '^', '~', '!'].includes(char)) {
      tokens.push({ type: 'operator', text: char });
      i++;
      prevSignificantTokenType = 'operator';
      prevSignificantWord = char;
      continue;
    }

    // 9. Punctuation
    if (['(', ')', ',', ';', '.', '{', '}'].includes(char)) {
      tokens.push({ type: 'punctuation', text: char });
      i++;
      prevSignificantTokenType = 'punctuation';
      prevSignificantWord = char;
      continue;
    }

    // 10. Multi-word Keywords check (e.g. 'GROUP BY', 'ORDER BY', 'LEFT JOIN', 'IS NULL', etc.)
    let matchedMultiWord = false;
    for (const phrase of MULTI_WORD_KEYWORDS) {
      const phraseRegex = new RegExp(`^${phrase.replace(/\s+/g, '\\s+')}\\b`, 'i');
      const phraseMatch = rest.match(phraseRegex);
      if (phraseMatch) {
        tokens.push({ type: 'keyword', text: phraseMatch[0] });
        i += phraseMatch[0].length;
        prevSignificantTokenType = 'keyword';
        prevSignificantWord = phrase.toUpperCase();
        matchedMultiWord = true;
        break;
      }
    }
    if (matchedMultiWord) continue;

    // 11. Word Identifiers (Keywords, Functions, Tables, Aliases, Columns)
    const wordMatch = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (wordMatch) {
      const word = wordMatch[0];
      const upperWord = word.toUpperCase();
      const lowerWord = word.toLowerCase();
      const afterWord = sql.substring(i + word.length);
      const isFollowedByOpenParen = /^\s*\(/.test(afterWord);

      // A. Function check: Either known function name OR word immediately followed by '('
      if (SQL_FUNCTIONS_SET.has(upperWord) || (isFollowedByOpenParen && !SQL_KEYWORDS_SET.has(upperWord))) {
        tokens.push({ type: 'function', text: word });
        prevSignificantTokenType = 'function';
        prevSignificantWord = upperWord;
      }
      // B. Keyword check
      else if (SQL_KEYWORDS_SET.has(upperWord)) {
        tokens.push({ type: 'keyword', text: word });
        prevSignificantTokenType = 'keyword';
        prevSignificantWord = upperWord;
      }
      // C. Alias check (following AS keyword)
      else if (prevSignificantWord === 'AS') {
        tokens.push({ type: 'alias', text: word });
        prevSignificantTokenType = 'alias';
        prevSignificantWord = null;
      }
      // D. Table check (following FROM, JOIN, INTO, UPDATE, TABLE or in known tables)
      else if (
        (prevSignificantWord && ['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE'].includes(prevSignificantWord)) ||
        knownTables.has(lowerWord)
      ) {
        tokens.push({ type: 'table', text: word });
        prevSignificantTokenType = 'table';
        prevSignificantWord = 'TABLE_NAME';
      }
      // E. Table Alias check (e.g. "FROM customers c" or "JOIN orders o" where c/o follows a table name)
      else if (prevSignificantTokenType === 'table' && prevSignificantWord === 'TABLE_NAME') {
        tokens.push({ type: 'alias', text: word });
        prevSignificantTokenType = 'alias';
        prevSignificantWord = null;
      }
      // F. Column / Identifier check
      else {
        tokens.push({ type: 'identifier', text: word });
        prevSignificantTokenType = 'identifier';
        prevSignificantWord = null;
      }

      i += word.length;
      continue;
    }

    // 12. Fallback character (any non-matched single char)
    tokens.push({ type: 'plain', text: char });
    i++;
  }

  return tokens;
}

/**
 * Returns clean, high-contrast Tailwind CSS class names for a given SQL token type.
 * Engineered for professional dark theme aesthetics and WCAG AAA readability.
 */
export function getSqlTokenColorClass(type: SqlTokenType): string {
  switch (type) {
    case 'keyword':
      // Vibrant Sky Blue (font-semibold for structural clarity)
      return 'text-sky-400 font-semibold';

    case 'function':
      // Vibrant Violet/Purple (font-medium)
      return 'text-purple-400 font-medium';

    case 'table':
      // Crisp Mint/Emerald Green
      return 'text-emerald-400 font-medium';

    case 'alias':
      // Distinguishable Teal/Cyan
      return 'text-teal-300 font-medium';

    case 'string':
      // Warm Amber / Gold
      return 'text-amber-300';

    case 'number':
      // Bright Coral / Orange
      return 'text-orange-400';

    case 'comment':
      // Muted Slate Gray italic
      return 'text-slate-500 italic';

    case 'operator':
      // Soft Rose / Accent
      return 'text-rose-400';

    case 'punctuation':
      // Subtle Slate
      return 'text-slate-400';

    case 'variable':
      // Bright Yellow / Lime
      return 'text-yellow-300 font-medium';

    case 'column':
    case 'identifier':
      // Crisp Off-White
      return 'text-slate-200';

    case 'plain':
    default:
      return 'text-slate-200';
  }
}
