import React, { useState } from 'react';
import {
  Table as TableIcon,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Terminal,
  Download,
  Copy,
  Check,
  Info,
  XCircle,
  Sparkles,
  PieChart,
  LayoutDashboard,
  FileSpreadsheet
} from 'lucide-react';
import { QueryExecutionResult } from '../../types/database';
import { ExcelExportService } from '../../services/excelExportService';

interface QueryResultsProps {
  result: QueryExecutionResult | null;
  isRunning: boolean;
  onCancelQuery?: () => void;
  onExplainResults?: (result: QueryExecutionResult) => void;
  onFixSqlError?: (failedSql: string, errorMessage: string) => void;
  onNavigateToVisualization?: () => void;
  onAddToDashboard?: (result: QueryExecutionResult) => void;
  sourceName?: string;
}

export const QueryResults: React.FC<QueryResultsProps> = ({
  result,
  isRunning,
  onCancelQuery,
  onExplainResults,
  onFixSqlError,
  onNavigateToVisualization,
  onAddToDashboard,
  sourceName
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [copied, setCopied] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleSort = (colName: string) => {
    if (sortColumn === colName) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colName);
      setSortDirection('asc');
    }
  };

  const copyAsJson = () => {
    if (!result?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCsv = () => {
    if (!result?.rows || !result.columns) return;
    const colNames = result.columns.map(c => c.name);
    const header = colNames.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    const csvRows = result.rows.map(row =>
      colNames
        .map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '""';
          let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          // Mitigate CSV formula injection
          if (/^[=+\-@\t\r]/.test(str)) {
            str = `'${str}`;
          }
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!result?.rows || !result.columns || result.rows.length === 0) return;
    setIsExportingExcel(true);
    setExportError(null);
    try {
      const tableSource = sourceName || ExcelExportService.extractTableFromSql(result.query);
      const filename = ExcelExportService.generateExcelFilename(tableSource || undefined);
      ExcelExportService.exportQueryResultToExcel(result.columns, result.rows, {
        filename,
        sourceName: tableSource || undefined,
        sheetName: tableSource || 'Query Results'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export query results to Excel.';
      console.error('Failed to export Excel file:', err);
      setExportError(msg);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Sort rows if sorted column is active
  const sortedRows = React.useMemo(() => {
    if (!result?.rows) return [];
    if (!sortColumn) return result.rows;

    return [...result.rows].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [result?.rows, sortColumn, sortDirection]);

  return (
    <div
      id="query-results-panel"
      className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden"
    >
      {/* Header Tabs & Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/90 select-none">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
            <TableIcon className="w-4 h-4 text-emerald-400" />
            <span>Query Results</span>
          </div>

          {result && result.status === 'success' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 font-mono">
                {result.rowCount.toLocaleString()} {result.rowCount === 1 ? 'row' : 'rows'}
              </span>
              {result.isTruncated && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  Limited
                </span>
              )}
            </div>
          )}
        </div>

        {result && result.status === 'success' && result.rows.length > 0 && (
          <div className="flex items-center space-x-2">
            {onNavigateToVisualization && (
              <button
                id="btn-quick-visualize"
                onClick={onNavigateToVisualization}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-purple-300 hover:text-white bg-purple-950/60 hover:bg-purple-900/80 rounded border border-purple-700/60 transition-colors"
                title="Visualize these query results in Visualization Studio"
              >
                <PieChart className="w-3.5 h-3.5 text-purple-400" />
                <span>Visualize</span>
              </button>
            )}
            {onAddToDashboard && (
              <button
                id="btn-add-to-dashboard"
                onClick={() => onAddToDashboard(result)}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 rounded border border-emerald-700/60 transition-colors"
                title="Add this query result as a dashboard widget"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add to Dashboard</span>
              </button>
            )}
            {onExplainResults && (
              <button
                id="btn-explain-results"
                onClick={() => onExplainResults(result)}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 rounded border border-indigo-700/60 transition-colors"
                title="Explain these query results with AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Explain Results</span>
              </button>
            )}
            <button
              id="btn-copy-json"
              onClick={copyAsJson}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded border border-slate-700/60 transition-colors"
              title="Copy result as JSON"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'JSON'}</span>
            </button>
            <button
              id="btn-export-csv"
              onClick={exportCsv}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded border border-slate-700/60 transition-colors"
              title="Export result as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              id="btn-export-excel"
              onClick={exportExcel}
              disabled={isExportingExcel}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded border border-slate-700/60 transition-colors disabled:opacity-50"
              title="Export result as Excel (.xlsx)"
            >
              {isExportingExcel ? (
                <div className="w-3.5 h-3.5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Excel</span>
            </button>
          </div>
        )}
      </div>

      {/* Excel Export Error Alert Banner */}
      {exportError && (
        <div
          id="export-excel-error-banner"
          className="px-4 py-1.5 bg-rose-950/60 border-b border-rose-900/60 text-[11px] text-rose-300 flex items-center justify-between select-none"
        >
          <div className="flex items-center space-x-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span className="truncate">Excel Export Failed: {exportError}</span>
          </div>
          <button
            onClick={() => setExportError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs px-1 font-semibold ml-2"
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Large Result Truncation Banner */}
      {result && result.status === 'success' && result.isTruncated && (
        <div
          id="result-truncated-banner"
          className="px-4 py-1.5 bg-amber-950/40 border-b border-amber-900/40 text-[11px] text-amber-200 flex items-center justify-between select-none"
        >
          <div className="flex items-center space-x-1.5 truncate">
            <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>
              Showing {result.rowCount.toLocaleString()} of more than {result.rowCount.toLocaleString()} available rows. (Result limited to prevent browser overload)
            </span>
          </div>
          <span className="text-[10px] text-amber-400 font-mono flex-shrink-0 ml-2">
            Add LIMIT to refine
          </span>
        </div>
      )}

      {/* Main Results Body */}
      <div className="flex-1 overflow-auto relative">
        {/* Loading state */}
        {isRunning && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin mb-3" />
            <p className="text-xs font-medium text-slate-300">Executing read-only analytical query...</p>
            <p className="text-[11px] text-slate-500 mt-1">Retrieving typed rows from active database connection</p>
            {onCancelQuery && (
              <button
                onClick={onCancelQuery}
                className="mt-4 px-3 py-1 text-xs text-rose-400 hover:text-rose-300 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors flex items-center space-x-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Execution</span>
              </button>
            )}
          </div>
        )}

        {/* Cancelled state */}
        {!isRunning && result?.status === 'cancelled' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="w-10 h-10 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-amber-400 mb-2">
              <XCircle className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h4 className="text-sm font-medium text-slate-200 mb-1">Query execution cancelled</h4>
            <p className="text-xs text-slate-400">The query was stopped before completion.</p>
          </div>
        )}

        {/* Error state */}
        {!isRunning && result?.status === 'error' && (
          <div className="p-6">
            <div className="max-w-2xl mx-auto rounded-lg bg-rose-950/30 border border-rose-900/60 p-4 text-rose-200">
              <div className="flex items-center space-x-2 text-rose-400 font-semibold text-xs mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>SQL Execution Error</span>
              </div>
              <pre className="font-mono text-xs text-rose-300/90 whitespace-pre-wrap bg-rose-950/60 p-3 rounded border border-rose-900/40 overflow-x-auto">
                {result.errorMessage || 'An error occurred while executing the SQL query.'}
              </pre>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-rose-900/40">
                <span className="text-[11px] text-slate-400">
                  DataPilot enforces strict Read-Only mode and single statements. Verify SQL syntax and database permissions.
                </span>
                {onFixSqlError && (
                  <button
                    id="btn-fix-with-ai"
                    onClick={() => onFixSqlError(result.query, result.errorMessage || '')}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors shadow-sm flex-shrink-0 ml-3"
                    title="Diagnose error and propose schema-grounded fix with AI"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Fix with AI</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state: No query has been executed yet */}
        {!isRunning && (!result || result.status === 'idle') && (
          <div
            id="empty-results-state"
            className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
              <Terminal className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h4 className="text-sm font-medium text-slate-300 mb-1">No query executed yet</h4>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Write a read-only SQL query in the editor above and click <span className="text-slate-300 font-medium">Run Query</span> (or press Ctrl+Enter) to view results in this grid.
            </p>
          </div>
        )}

        {/* Empty result set (query succeeded, 0 rows returned) */}
        {!isRunning && result?.status === 'success' && result.rowCount === 0 && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <div className="w-10 h-10 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-2">
              <TableIcon className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h4 className="text-sm font-medium text-slate-300 mb-1">0 rows returned</h4>
            <p className="text-xs text-slate-400">The query executed successfully but produced an empty result set.</p>
          </div>
        )}

        {/* Dynamic Data Table */}
        {!isRunning && result?.status === 'success' && result.rowCount > 0 && (
          <table className="w-full border-collapse text-left text-xs font-mono">
            <thead className="bg-slate-950/95 sticky top-0 z-10 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-2.5 px-3 w-12 border-r border-slate-800 text-slate-600 font-normal select-none bg-slate-950/95">
                  #
                </th>
                {result.columns.map(col => {
                  const isSorted = sortColumn === col.name;
                  return (
                    <th
                      key={col.name}
                      onClick={() => handleSort(col.name)}
                      className="py-2.5 px-3 border-r border-slate-800 font-semibold text-slate-300 cursor-pointer hover:bg-slate-800/60 transition-colors select-none group"
                    >
                      <div className="flex items-center justify-between space-x-2">
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="truncate">{col.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal font-mono group-hover:text-slate-400">
                            {col.dataType}
                          </span>
                        </div>
                        <span className="text-slate-500 group-hover:text-slate-300 ml-1">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-emerald-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                          )}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {sortedRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="hover:bg-slate-800/40 transition-colors font-mono text-[11px]"
                >
                  <td className="py-2 px-3 border-r border-slate-800 text-slate-600 select-none bg-slate-950/30 sticky left-0">
                    {rowIdx + 1}
                  </td>
                  {result.columns.map(col => {
                    const value = row[col.name];
                    const isNull = value === null || value === undefined;
                    const isNumber = typeof value === 'number';

                    return (
                      <td
                        key={col.name}
                        className={`py-2 px-3 border-r border-slate-800/60 whitespace-nowrap truncate max-w-xs ${
                          isNumber ? 'text-right text-sky-300 font-medium' : 'text-slate-300'
                        }`}
                      >
                        {isNull ? (
                          <span className="text-slate-600 italic">null</span>
                        ) : typeof value === 'boolean' ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            value
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {String(value)}
                          </span>
                        ) : isNumber ? (
                          <span>{value.toLocaleString()}</span>
                        ) : typeof value === 'object' ? (
                          <span className="text-indigo-300 truncate">{JSON.stringify(value)}</span>
                        ) : (
                          <span>{String(value)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
