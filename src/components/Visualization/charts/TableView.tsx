import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { QueryResultColumn } from '../../../types/database';

interface TableViewProps {
  columns: QueryResultColumn[];
  rows: Record<string, unknown>[];
}

export const TableView: React.FC<TableViewProps> = ({ columns, rows }) => {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div id="visualization-table-view" className="w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="sticky top-0 bg-slate-850 text-slate-400 font-semibold border-b border-slate-800 z-10">
            <tr>
              <th className="px-3 py-2 text-slate-400 font-mono text-[11px] w-12 text-center border-r border-slate-800">
                #
              </th>
              {columns.map(col => (
                <th key={col.name} className="px-3 py-2 font-medium">
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-200 font-semibold">{col.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({col.dataType})</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {pageRows.map((row, idx) => {
              const globalIdx = page * pageSize + idx + 1;
              return (
                <tr key={globalIdx} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-3 py-1.5 text-center text-[10px] text-slate-400 border-r border-slate-800/80">
                    {globalIdx}
                  </td>
                  {columns.map(col => {
                    const val = row[col.name];
                    return (
                      <td key={col.name} className="px-3 py-1.5 whitespace-nowrap">
                        {val === null || val === undefined ? (
                          <span className="text-slate-400 italic">NULL</span>
                        ) : typeof val === 'object' ? (
                          JSON.stringify(val)
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-850 text-xs text-slate-400">
          <div>
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, rows.length)} of{' '}
            {rows.length} rows
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-300">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
