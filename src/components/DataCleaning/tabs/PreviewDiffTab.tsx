import React, { useState, useMemo } from 'react';
import { Eye, CheckCircle2, AlertTriangle, ArrowRight, Filter, ShieldCheck, Download } from 'lucide-react';
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
  const [filterMode, setFilterMode] = useState<'all' | 'modified' | 'removed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const cleanedRows = useMemo(() => {
    return preview?.cleanedRows || [];
  }, [preview?.cleanedRows]);

  // Filter cleaned rows based on mode and search
  const displayedRows = useMemo(() => {
    if (!preview) return [];

    let list = cleanedRows;
    if (filterMode === 'modified') {
      list = list.filter((_, idx) => modifiedIndicesSet.has(idx));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(row =>
        Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
      );
    }

    return list.slice(0, 50); // display top 50
  }, [preview, cleanedRows, filterMode, modifiedIndicesSet, searchQuery]);

  if (!preview) {
    return (
      <div className="p-12 rounded-xl bg-slate-900/40 border border-slate-800 text-center max-w-4xl mx-auto">
        <Eye className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-white">No Active Preview Generated</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-4">
          Click the button below to execute the transformation pipeline across your dataset and inspect cell-level diffs and quality score improvements.
        </p>
        <button
          onClick={onRunPreview}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors"
        >
          <Eye className="w-4 h-4" />
          <span>{isLoading ? 'Computing Preview...' : 'Generate Full Dataset Preview'}</span>
        </button>
      </div>
    );
  }

  const beforeScore = preview.qualityBefore?.overallQualityScore ?? 75;
  const afterScore = preview.qualityAfter?.overallQualityScore ?? beforeScore;
  const delta = afterScore - beforeScore;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Summary Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Rows Affected</div>
          <div className="text-lg font-bold font-mono text-indigo-400 mt-0.5">
            {preview.affectedRowCount.toLocaleString()} rows
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cleaned Output Rows</div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
            {preview.totalCleanedRows.toLocaleString()} rows
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rows Removed</div>
          <div className="text-lg font-bold font-mono text-rose-400 mt-0.5">
            {removedRowsCount.toLocaleString()} rows
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">DQ Score Impact</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5 flex items-baseline space-x-1.5">
              <span>{beforeScore}</span>
              <ArrowRight className="w-3 h-3 text-slate-500 inline" />
              <span className="text-emerald-400">{afterScore}</span>
            </div>
          </div>
          {delta > 0 && (
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
              +{delta}
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex space-x-1.5">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            All Cleaned Rows ({preview.totalCleanedRows.toLocaleString()})
          </button>
          <button
            onClick={() => setFilterMode('modified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterMode === 'modified'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Modified Only ({modifiedIndicesSet.size.toLocaleString()})
          </button>
          <button
            onClick={() => setFilterMode('removed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterMode === 'removed'
                ? 'bg-rose-600 text-white font-semibold'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            Removed Only ({removedRowsCount.toLocaleString()})
          </button>
        </div>

        <input
          type="text"
          placeholder="Filter rows by keyword..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-hidden font-mono w-60"
        />
      </div>

      {/* Diff Table */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          {filterMode === 'removed' ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              {removedRowsCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-rose-400 font-semibold">{removedRowsCount.toLocaleString()} rows removed based on your missing value / duplicate / outlier filter steps.</p>
                  <p className="text-slate-500 font-mono text-[11px]">Original row count: {preview.totalOriginalRows.toLocaleString()} → Cleaned row count: {preview.totalCleanedRows.toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-slate-500">No rows removed by the current cleaning steps.</p>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
              <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Row #</th>
                  {preview.columns.map(c => (
                    <th key={c.name} className="p-2.5 whitespace-nowrap">
                      <span>{c.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal ml-1">({c.dataType})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={preview.columns.length + 1} className="p-6 text-center text-slate-500">
                      No rows match the filter.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row, idx) => {
                    const isModified = modifiedIndicesSet.has(idx);
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-800/50 ${
                          isModified ? 'bg-indigo-950/15' : ''
                        }`}
                      >
                        <td className="p-2.5 text-slate-500">
                          <span className={isModified ? 'text-indigo-400 font-bold' : ''}>
                            #{idx + 1}
                          </span>
                        </td>
                        {preview.columns.map(c => {
                          const val = row[c.name];
                          return (
                            <td
                              key={c.name}
                              className={`p-2.5 whitespace-nowrap ${
                                val === null || val === undefined
                                  ? 'text-slate-600 italic'
                                  : 'text-slate-200'
                              }`}
                            >
                              {val === null || val === undefined ? 'NULL' : String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-2.5 bg-slate-950 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-800">
          <span>Showing up to 50 rows in sample preview</span>
          <span>Full dataset will be processed on Save / Apply</span>
        </div>
      </div>
    </div>
  );
};
