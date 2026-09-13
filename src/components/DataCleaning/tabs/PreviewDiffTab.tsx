import React, { useState, useMemo } from 'react';
import {
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  ShieldCheck,
  Download,
  Layers,
  Sparkles,
  Columns,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { CleaningPreviewResult } from '../../../types/cleaning';

interface PreviewDiffTabProps {
  dataset: ImportedDataset;
  preview: CleaningPreviewResult | null;
  onRunPreview: () => void;
  isLoading?: boolean;
}

export const PreviewDiffTab: React.FC<PreviewDiffTabProps> = ({
  dataset,
  preview,
  onRunPreview,
  isLoading
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'modified' | 'removed' | 'added_cols' | 'removed_cols'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Map of changed cells by `rowIndex:columnName` -> CellChange
  const changedCellsMap = useMemo(() => {
    const map = new Map<string, { original: unknown; cleaned: unknown }>();
    if (!preview) return map;
    for (const change of preview.changedCells) {
      map.set(`${change.rowIndex}:${change.column}`, {
        original: change.original,
        cleaned: change.cleaned
      });
    }
    return map;
  }, [preview]);

  const modifiedIndicesSet = useMemo(() => {
    if (!preview) return new Set<number>();
    if (preview.modifiedRowIndices && preview.modifiedRowIndices.length > 0) {
      return new Set(preview.modifiedRowIndices);
    }
    return new Set(preview.changedCells.map(c => c.rowIndex));
  }, [preview]);

  const removedRowsCount = useMemo(() => {
    if (!preview) return 0;
    if (typeof preview.removedRows === 'number') return preview.removedRows;
    return Math.max(0, preview.totalOriginalRows - preview.totalCleanedRows);
  }, [preview]);

  const originalColNames = useMemo(() => dataset.columns.map(c => c.name), [dataset.columns]);
  const cleanedColNames = useMemo(() => (preview ? preview.columns.map(c => c.name) : []), [preview]);

  const addedColumns = useMemo(() => {
    return cleanedColNames.filter(c => !originalColNames.includes(c));
  }, [cleanedColNames, originalColNames]);

  const removedColumns = useMemo(() => {
    return originalColNames.filter(c => !cleanedColNames.includes(c));
  }, [cleanedColNames, originalColNames]);

  const cleanedRows = useMemo(() => {
    return preview?.cleanedRows || [];
  }, [preview?.cleanedRows]);

  // Filter cleaned rows based on mode and search
  const displayedRows = useMemo(() => {
    if (!preview) return [];

    let list = cleanedRows.map((row, idx) => ({ row, idx }));
    if (filterMode === 'modified') {
      list = list.filter(item => modifiedIndicesSet.has(item.idx));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        Object.values(item.row).some(v => String(v ?? '').toLowerCase().includes(q))
      );
    }

    return list.slice(0, 50); // display top 50 sample
  }, [preview, cleanedRows, filterMode, modifiedIndicesSet, searchQuery]);

  if (!preview) {
    return (
      <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center max-w-4xl mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-900/40 flex items-center justify-center text-indigo-400 mx-auto">
          <Eye className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-white">No Active Preview Generated</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Run the transformation pipeline across your dataset to inspect before-and-after cell diffs, schema changes, and quality improvements.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={onRunPreview}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center space-x-2 transition-all shadow-lg shadow-indigo-950/50"
          >
            <Eye className="w-4 h-4" />
            <span>{isLoading ? 'Computing Pipeline Preview...' : 'Generate Full Dataset Preview'}</span>
          </button>
        </div>
      </div>
    );
  }

  const beforeScore = preview.qualityBefore?.overallQualityScore ?? 75;
  const afterScore = preview.qualityAfter?.overallQualityScore ?? beforeScore;
  const delta = afterScore - beforeScore;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rows Affected</div>
          <div className="text-lg font-bold font-mono text-indigo-400 mt-0.5">
            {preview.affectedRowCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{modifiedIndicesSet.size} modified cells</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cleaned Rows</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
            {preview.totalCleanedRows.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">of {preview.totalOriginalRows.toLocaleString()} original</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rows Removed</div>
          <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">
            {removedRowsCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">via filters/dedup</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Columns Delta</div>
          <div className="text-lg font-bold font-mono text-white mt-0.5">
            {preview.columns.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            +{addedColumns.length} added, -{removedColumns.length} dropped
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">DQ Score Impact</div>
          <div className="text-lg font-bold font-mono text-white mt-0.5 flex items-center space-x-1.5">
            <span className="text-slate-400">{beforeScore}</span>
            <span className="text-slate-600">→</span>
            <span className="text-emerald-400 font-bold">{afterScore}</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
            {delta >= 0 ? `+${delta}` : delta} pts change
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Execution Speed</div>
          <div className="text-lg font-bold font-mono text-white mt-0.5 flex items-center space-x-1">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>{preview.executionTimeMs}ms</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Deterministic</div>
        </div>
      </div>

      {/* Filter and Mode Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            All Cleaned Rows ({preview.totalCleanedRows.toLocaleString()})
          </button>
          <button
            onClick={() => setFilterMode('modified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterMode === 'modified'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Modified Rows ({modifiedIndicesSet.size.toLocaleString()})
          </button>
          <button
            onClick={() => setFilterMode('removed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterMode === 'removed'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Removed Rows ({removedRowsCount.toLocaleString()})
          </button>
          <button
            onClick={() => setFilterMode('added_cols')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterMode === 'added_cols'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Added Columns ({addedColumns.length})
          </button>
          <button
            onClick={() => setFilterMode('removed_cols')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterMode === 'removed_cols'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Dropped Columns ({removedColumns.length})
          </button>
        </div>

        <input
          type="text"
          placeholder="Search sample preview..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden font-mono w-56"
        />
      </div>

      {/* Diff Table / Panel */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        {filterMode === 'removed' ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-3">
            {removedRowsCount > 0 ? (
              <div className="space-y-2 max-w-md mx-auto">
                <p className="text-rose-400 font-bold text-sm">
                  {removedRowsCount.toLocaleString()} rows removed from output
                </p>
                <p className="text-slate-400 leading-relaxed">
                  These rows were safely filtered out by remove missing values, deduplication, outlier elimination, or row filter steps.
                </p>
                <p className="text-slate-500 font-mono text-[11px] pt-2">
                  Original row count: {preview.totalOriginalRows.toLocaleString()} → Cleaned row count: {preview.totalCleanedRows.toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-slate-500">No rows were removed by the current pipeline.</p>
            )}
          </div>
        ) : filterMode === 'added_cols' ? (
          <div className="p-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Columns Created or Extracted by Pipeline ({addedColumns.length})
            </h4>
            {addedColumns.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No new columns were added.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {addedColumns.map(colName => {
                  const meta = preview.columns.find(c => c.name === colName);
                  return (
                    <div key={colName} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-emerald-400">{colName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                          {meta?.dataType || 'text'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Generated by pipeline step</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : filterMode === 'removed_cols' ? (
          <div className="p-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Columns Dropped or Renamed ({removedColumns.length})
            </h4>
            {removedColumns.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No columns were dropped.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {removedColumns.map(colName => (
                  <div key={colName} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="font-mono text-xs font-bold text-rose-400 line-through">{colName}</span>
                    <p className="text-[11px] text-slate-500 mt-1">Removed by drop / split / merge step</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
              <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3 whitespace-nowrap">Row #</th>
                  {preview.columns.map(c => {
                    const isNew = addedColumns.includes(c.name);
                    return (
                      <th key={c.name} className="p-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className={isNew ? 'text-emerald-400 font-bold' : ''}>{c.name}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({c.dataType})</span>
                          {isNew && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-900">
                              NEW
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={preview.columns.length + 1} className="p-8 text-center text-slate-500">
                      No rows match the active filter criteria.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map(({ row, idx }) => {
                    const isRowModified = modifiedIndicesSet.has(idx);
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isRowModified ? 'bg-indigo-950/15' : ''
                        }`}
                      >
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          <span className={isRowModified ? 'text-indigo-400 font-bold' : ''}>
                            #{idx + 1}
                          </span>
                        </td>
                        {preview.columns.map(c => {
                          const val = row[c.name];
                          const cellChange = changedCellsMap.get(`${idx}:${c.name}`);
                          const isCellChanged = !!cellChange;

                          return (
                            <td
                              key={c.name}
                              className={`p-3 whitespace-nowrap ${
                                isCellChanged
                                  ? 'bg-indigo-950/50 text-indigo-200 border-x border-indigo-900/40'
                                  : val === null || val === undefined
                                  ? 'text-slate-600 italic'
                                  : 'text-slate-200'
                              }`}
                            >
                              {isCellChanged ? (
                                <div className="flex items-center space-x-1.5">
                                  <span className="line-through text-slate-500 text-[11px]">
                                    {cellChange.original === null || cellChange.original === undefined
                                      ? 'NULL'
                                      : String(cellChange.original)}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                                  <span className="text-white font-bold">
                                    {cellChange.cleaned === null || cellChange.cleaned === undefined
                                      ? 'NULL'
                                      : String(cellChange.cleaned)}
                                  </span>
                                </div>
                              ) : val === null || val === undefined ? (
                                'NULL'
                              ) : (
                                String(val)
                              )}
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
        )}

        {/* Table Footer */}
        <div className="p-3 bg-slate-950 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
          <span>Showing sample preview rows (Top 50)</span>
          <span>Original dataset remains read-only & unmodified</span>
        </div>
      </div>
    </div>
  );
};
