import React, { useState, useMemo } from 'react';
import { Copy, Trash2, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';

interface DuplicatesTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const DuplicatesTab: React.FC<DuplicatesTabProps> = ({ dataset, onAddStep }) => {
  const [matchScope, setMatchScope] = useState<'all' | 'subset'>('all');
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [keepStrategy, setKeepStrategy] = useState<'first' | 'last'>('first');

  const rows = dataset.previewRows || [];

  // Detect duplicate rows in preview
  const duplicateAnalysis = useMemo(() => {
    const targetCols = matchScope === 'all' ? dataset.columns.map(c => c.name) : selectedCols;
    if (targetCols.length === 0) return { count: 0, duplicateRows: [] };

    const seen = new Map<string, number>();
    const dupIndices: number[] = [];

    rows.forEach((r, idx) => {
      const key = targetCols.map(c => String(r[c] ?? '')).join('::');
      if (seen.has(key)) {
        dupIndices.push(idx);
      } else {
        seen.set(key, idx);
      }
    });

    return {
      count: dupIndices.length,
      duplicateRows: dupIndices.slice(0, 10).map(idx => ({ idx, row: rows[idx] }))
    };
  }, [rows, dataset.columns, matchScope, selectedCols]);

  const handleAddStep = () => {
    const targetCols = matchScope === 'all' ? [] : selectedCols;
    const desc = targetCols.length > 0
      ? `Remove duplicate rows matching on [${targetCols.join(', ')}] (keep ${keepStrategy})`
      : `Remove exact duplicate rows (keep ${keepStrategy})`;

    const step: TransformStep = {
      id: `step_${Date.now()}_dedup`,
      type: 'REMOVE_DUPLICATES',
      description: desc,
      params: {
        columns: targetCols,
        keep: keepStrategy
      },
      enabled: true,
      createdAt: new Date().toISOString()
    };

    onAddStep(step);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Duplicate Summary Banner */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-400">
            <Copy className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Duplicate Detection</h4>
            <p className="text-xs text-slate-400">
              {duplicateAnalysis.count > 0 ? (
                <span>
                  Found <strong className="text-amber-400 font-mono">{duplicateAnalysis.count}</strong> duplicate rows in preview.
                </span>
              ) : (
                <span className="text-emerald-400">No duplicate rows found in current preview sample.</span>
              )}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Duplicate Rate</div>
          <div className="text-lg font-bold font-mono text-white">
            {rows.length > 0 ? Math.round((duplicateAnalysis.count / rows.length) * 1000) / 10 : 0}%
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-indigo-400" />
          <span>Configure Deduplication Rule</span>
        </h4>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Duplicate Matching Scope</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="matchScope"
                  checked={matchScope === 'all'}
                  onChange={() => setMatchScope('all')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Exact Match across all columns</span>
              </label>
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="matchScope"
                  checked={matchScope === 'subset'}
                  onChange={() => setMatchScope('subset')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Match specific key columns only</span>
              </label>
            </div>
          </div>

          {matchScope === 'subset' && (
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Select key columns to match</label>
              <div className="flex flex-wrap gap-2">
                {dataset.columns.map(col => {
                  const checked = selectedCols.includes(col.name);
                  return (
                    <button
                      key={col.name}
                      onClick={() => {
                        setSelectedCols(prev =>
                          checked ? prev.filter(c => c !== col.name) : [...prev, col.name]
                        );
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                        checked
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {col.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Retention Strategy</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="keepStrategy"
                  checked={keepStrategy === 'first'}
                  onChange={() => setKeepStrategy('first')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Keep First occurrence (discard subsequent duplicates)</span>
              </label>
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="keepStrategy"
                  checked={keepStrategy === 'last'}
                  onChange={() => setKeepStrategy('last')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Keep Last occurrence (keep latest version)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Estimated duplicate rows removed: <span className="text-indigo-400 font-mono font-bold">{duplicateAnalysis.count} rows</span>
          </div>
          <button
            onClick={handleAddStep}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Deduplication Step to Pipeline</span>
          </button>
        </div>
      </div>

      {/* Duplicate Rows Preview Sample */}
      {duplicateAnalysis.duplicateRows.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Detected Duplicate Sample (First 10)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <th className="p-2 font-mono">Row #</th>
                  {dataset.columns.slice(0, 6).map(c => (
                    <th key={c.name} className="p-2 font-mono">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {duplicateAnalysis.duplicateRows.map(({ idx, row }) => (
                  <tr key={idx} className="hover:bg-slate-800/40 bg-amber-950/10">
                    <td className="p-2 font-mono text-amber-400">#{idx + 1}</td>
                    {dataset.columns.slice(0, 6).map(c => (
                      <td key={c.name} className="p-2 font-mono truncate max-w-[150px]">
                        {String(row[c.name] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
