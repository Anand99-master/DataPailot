/**
 * Lightweight SQL formatter utility for the SQL editor.
 * Formats standard SQL clauses and keywords cleanly.
 */

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'INNER JOIN', 'OUTER JOIN', 'FULL JOIN', 'CROSS JOIN', 'ON', 'GROUP BY',
  'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'INSERT INTO',
  'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'WITH', 'AS', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'IN', 'NOT IN', 'BETWEEN', 'LIKE', 'ILIKE', 'IS NULL',
  'IS NOT NULL', 'EXISTS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'ASC', 'DESC'
];

export function formatSql(sql: string): string {
  if (!sql || !sql.trim()) return '';

  let cleaned = sql
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .trim();

  // Highlight clauses with appropriate line breaks
  const majorClauses = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY',
    'LIMIT', 'OFFSET', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'JOIN',
    'UNION ALL', 'UNION', 'WITH'
  ];

  // Regex replace to ensure major clauses start on new lines
  for (const clause of majorClauses) {
    const regex = new RegExp(`(^|\\s+)(${clause})\\b`, 'gi');
    cleaned = cleaned.replace(regex, (match, p1, p2) => {
      const upper = p2.toUpperCase();
      return p1.includes('\n') ? `${p1}${upper}` : `\n${upper}`;
    });
  }

  // Capitalize common SQL keywords
  for (const kw of SQL_KEYWORDS) {
    const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
    cleaned = cleaned.replace(regex, (match) => match.toUpperCase());
  }

  // Clean up excessive blank lines and leading newline
  return cleaned
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}
