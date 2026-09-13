import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ColumnMetadata } from '../../types/import';

interface WindowedDataPreviewProps {
  rows: Record<string, unknown>[];
  columns: ColumnMetadata[] | string[];
  totalRows?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  className?: string;
  maxDisplayHeight?: string;
}

export const WindowedDataPreview: React.FC<WindowedDataPreviewProps> = ({
  rows,
  columns,
  totalRows = rows.length,
  pageSize: initialPageSize = 25,
  className = '',
  maxDisplayHeight = 'max-h-96'
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const colObjects: { name: string; type?: string }[] = columns.map(c => {
    if (typeof c === 'string') return { name: c, type: 'text' };
    return { name: c.name, type: c.dataType };
  });

  // Client-side pagination if rows array has all rows, or windowed slice
  const isClientSideWindow = rows.length > pageSize;
  const effectiveTotal = Math.max(totalRows, rows.length);
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));

  // Sort rows if client-side
  let displayRows = rows;
  if (sortCol && isClientSideWindow) {
    displayRows = [...rows].sort((a, b) => {
      const vA = a[sortCol];
      const vB = b[sortCol];
      if (vA === vB) return 0;
      if (vA === null || vA === undefined) return 1;
      if (vB === null || vB === undefined) return -1;
      const res = vA < vB ? -1 : 1;
      return sortDir === 'asc' ? res : -res;
    });
  }

  const pagedRows = isClientSideWindow
    ? displayRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : displayRows;

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(colName);
      setSortDir('asc');
    }
  };

  const startRowIndex = (currentPage - 1) * pageSize + 1;
  const endRowIndex = Math.min(currentPage * pageSize, effectiveTotal);

  return (
    <div className={`flex flex-col border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 ${className}`}>
      {/* Table Container */}
      <div className={`overflow-auto ${maxDisplayHeight}`}>
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400 w-12 text-center border-r border-slate-200 dark:border-slate-700">
                #
              </th>
              {colObjects.map(col => (
                <th
                  key={col.name}
                  onClick={() => handleSort(col.name)}
                  className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors border-r border-slate-200 dark:border-slate-700 last:border-r-0 whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{col.name}</span>
                      {col.type && <span className="text-[10px] text-slate-400 font-normal uppercase">{col.type}</span>}
                    </div>
                    <div className="text-slate-400">
                      {sortCol === col.name ? (
                        sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={colObjects.length + 1} className="py-8 text-center text-slate-400">
                  No rows to display.
                </td>
              </tr>
            ) : (
              pagedRows.map((row, rIdx) => {
                const globalRowNumber = startRowIndex + rIdx;
                return (
                  <tr key={rIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-center text-slate-400 border-r border-slate-100 dark:border-slate-800 select-none">
                      {globalRowNumber.toLocaleString()}
                    </td>
                    {colObjects.map(col => {
                      const val = row[col.name];
                      const isNull = val === null || val === undefined;
                      return (
                        <td
                          key={col.name}
                          className={`py-2 px-3 border-r border-slate-100 dark:border-slate-800 last:border-r-0 truncate max-w-xs ${
                            isNull ? 'text-slate-300 dark:text-slate-600 italic' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isNull ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>Showing rows <strong className="text-slate-800 dark:text-slate-200">{startRowIndex.toLocaleString()}</strong> to <strong className="text-slate-800 dark:text-slate-200">{endRowIndex.toLocaleString()}</strong> of <strong className="text-slate-800 dark:text-slate-200">{effectiveTotal.toLocaleString()}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Page size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 text-xs">
              Page <strong className="text-slate-800 dark:text-slate-200">{currentPage}</strong> of <strong className="text-slate-800 dark:text-slate-200">{totalPages}</strong>
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
