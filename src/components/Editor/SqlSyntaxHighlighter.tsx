import React, { useMemo } from 'react';
import { tokenizeSql, getSqlTokenColorClass } from '../../utils/sqlHighlighter';
import { DiscoveredTable, TableDetailsResult } from '../../types/database';

interface SqlSyntaxHighlighterProps {
  sql: string;
  tables?: DiscoveredTable[];
  tableDetailsCache?: Record<string, TableDetailsResult>;
  dialect?: string;
  className?: string;
}

export const SqlSyntaxHighlighter: React.FC<SqlSyntaxHighlighterProps> = ({
  sql,
  tables = [],
  tableDetailsCache = {},
  dialect = 'postgresql',
  className = ''
}) => {
  const tokens = useMemo(() => {
    return tokenizeSql(sql, { tables, tableDetailsCache, dialect });
  }, [sql, tables, tableDetailsCache, dialect]);

  // When SQL query ends with a newline, render an extra newline character so pre layer height matches textarea exactly
  const hasTrailingNewline = sql.endsWith('\n');

  return (
    <pre
      aria-hidden="true"
      className={`m-0 p-3 font-mono text-xs leading-5 whitespace-pre select-none pointer-events-none box-border ${className}`}
      style={{ tabSize: 2 }}
    >
      <code>
        {tokens.map((token, index) => {
          const colorClass = getSqlTokenColorClass(token.type);
          return (
            <span key={index} className={colorClass}>
              {token.text}
            </span>
          );
        })}
        {hasTrailingNewline && '\n'}
      </code>
    </pre>
  );
};
