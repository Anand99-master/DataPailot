import { useState, useEffect, useMemo } from 'react';
import { SqlSnippet } from '../types/database';

export const BUILT_IN_SNIPPETS: SqlSnippet[] = [
  // BASIC
  { id: 'b-1', name: 'Select all rows', description: 'Retrieve all columns and rows from a table.', sql: 'SELECT * FROM {{table}} LIMIT 50;', category: 'Basic', isCustom: false, isFavorite: false, prefix: 'selall' },
  { id: 'b-2', name: 'Select specific columns', description: 'Retrieve specific columns.', sql: 'SELECT\n  {{column}},\n  {{column}}\nFROM {{table}}\nLIMIT 50;', category: 'Basic', isCustom: false, isFavorite: false, prefix: 'selcol' },
  { id: 'b-3', name: 'DISTINCT values', description: 'Find unique values in a column.', sql: 'SELECT DISTINCT {{column}}\nFROM {{table}}\nORDER BY 1;', category: 'Basic', isCustom: false, isFavorite: false, prefix: 'dist' },
  { id: 'b-4', name: 'WHERE filter', description: 'Filter rows based on a condition.', sql: 'SELECT *\nFROM {{table}}\nWHERE {{column}} = \'value\'\nLIMIT 50;', category: 'Basic', isCustom: false, isFavorite: false, prefix: 'where' },
  { id: 'b-5', name: 'ORDER BY', description: 'Sort the result set.', sql: 'SELECT *\nFROM {{table}}\nORDER BY {{column}} DESC\nLIMIT 50;', category: 'Basic', isCustom: false, isFavorite: false, prefix: 'orderby' },
  
  // AGGREGATION
  { id: 'a-1', name: 'COUNT', description: 'Count total rows.', sql: 'SELECT COUNT(*) AS total_rows\nFROM {{table}};', category: 'Aggregation', isCustom: false, isFavorite: false, prefix: 'count' },
  { id: 'a-2', name: 'GROUP BY', description: 'Group rows and calculate aggregate metrics.', sql: 'SELECT\n  {{column}},\n  COUNT(*) AS count,\n  SUM({{metric_column}}) AS total\nFROM {{table}}\nGROUP BY 1\nORDER BY 2 DESC;', category: 'Aggregation', isCustom: false, isFavorite: false, prefix: 'group' },
  { id: 'a-3', name: 'HAVING', description: 'Filter aggregated data.', sql: 'SELECT\n  {{column}},\n  COUNT(*) AS count\nFROM {{table}}\nGROUP BY 1\nHAVING COUNT(*) > 10\nORDER BY 2 DESC;', category: 'Aggregation', isCustom: false, isFavorite: false, prefix: 'having' },
  
  // JOINS
  { id: 'j-1', name: 'INNER JOIN', description: 'Join two tables on a related column.', sql: 'SELECT\n  a.*,\n  b.*\nFROM {{table}} a\nINNER JOIN {{table}} b ON a.{{column}} = b.{{column}};', category: 'Joins', isCustom: false, isFavorite: false, prefix: 'ijoin' },
  { id: 'j-2', name: 'LEFT JOIN', description: 'Left join two tables.', sql: 'SELECT\n  a.*,\n  b.*\nFROM {{table}} a\nLEFT JOIN {{table}} b ON a.{{column}} = b.{{column}};', category: 'Joins', isCustom: false, isFavorite: false, prefix: 'ljoin' },
  
  // DATE ANALYSIS
  { id: 'd-1', name: 'Filter by date', description: 'Filter rows by a date range.', sql: 'SELECT *\nFROM {{table}}\nWHERE {{date_column}} >= \'2023-01-01\'\n  AND {{date_column}} < \'2024-01-01\';', category: 'Date Analysis', isCustom: false, isFavorite: false, prefix: 'datef' },
  { id: 'd-2', name: 'Monthly aggregation', description: 'Aggregate metrics by month.', sql: 'SELECT\n  DATE_TRUNC(\'month\', {{date_column}}) AS month,\n  COUNT(*) AS row_count\nFROM {{table}}\nGROUP BY 1\nORDER BY 1;', category: 'Date Analysis', isCustom: false, isFavorite: false, prefix: 'monthagg' },
  
  // ANALYTICS
  { id: 'an-1', name: 'Top N', description: 'Find the top N records based on a metric.', sql: 'SELECT\n  {{column}},\n  SUM({{metric_column}}) AS total\nFROM {{table}}\nGROUP BY 1\nORDER BY 2 DESC\nLIMIT 10;', category: 'Analytics', isCustom: false, isFavorite: false, prefix: 'topn' },
  { id: 'an-2', name: 'RANK', description: 'Calculate rank over a partition.', sql: 'SELECT\n  {{column}},\n  {{metric_column}},\n  RANK() OVER(PARTITION BY {{column}} ORDER BY {{metric_column}} DESC) as rank\nFROM {{table}};', category: 'Analytics', isCustom: false, isFavorite: false, prefix: 'rank' },
  { id: 'an-3', name: 'Running total', description: 'Calculate a cumulative sum.', sql: 'SELECT\n  {{date_column}},\n  {{metric_column}},\n  SUM({{metric_column}}) OVER(ORDER BY {{date_column}}) as running_total\nFROM {{table}};', category: 'Analytics', isCustom: false, isFavorite: false, prefix: 'running' },
  
  // DATA QUALITY
  { id: 'dq-1', name: 'NULL check', description: 'Find rows with NULL values in a column.', sql: 'SELECT *\nFROM {{table}}\nWHERE {{column}} IS NULL;', category: 'Data Quality', isCustom: false, isFavorite: false, prefix: 'nullchk' },
  { id: 'dq-2', name: 'Duplicate detection', description: 'Identify duplicate records.', sql: 'SELECT\n  {{column}},\n  COUNT(*) as occurrences\nFROM {{table}}\nGROUP BY 1\nHAVING COUNT(*) > 1\nORDER BY 2 DESC;', category: 'Data Quality', isCustom: false, isFavorite: false, prefix: 'dup' }
];

export function useSnippets() {
  const [customSnippets, setCustomSnippets] = useState<SqlSnippet[]>(() => {
    try {
      const saved = localStorage.getItem('datapilot_custom_snippets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('datapilot_snippet_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('datapilot_custom_snippets', JSON.stringify(customSnippets));
  }, [customSnippets]);

  useEffect(() => {
    localStorage.setItem('datapilot_snippet_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const allSnippets = useMemo(() => {
    return [...BUILT_IN_SNIPPETS, ...customSnippets].map(s => ({
      ...s,
      isFavorite: favorites.includes(s.id)
    }));
  }, [customSnippets, favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const addSnippet = (snippet: Omit<SqlSnippet, 'id' | 'isCustom' | 'isFavorite' | 'createdAt' | 'updatedAt'>) => {
    const newSnippet: SqlSnippet = {
      ...snippet,
      id: `cs-${Date.now()}`,
      isCustom: true,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCustomSnippets(prev => [...prev, newSnippet]);
  };

  const updateSnippet = (id: string, updates: Partial<SqlSnippet>) => {
    setCustomSnippets(prev => prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s));
  };

  const deleteSnippet = (id: string) => {
    setCustomSnippets(prev => prev.filter(s => s.id !== id));
    setFavorites(prev => prev.filter(f => f !== id));
  };

  return {
    snippets: allSnippets,
    toggleFavorite,
    addSnippet,
    updateSnippet,
    deleteSnippet
  };
}
