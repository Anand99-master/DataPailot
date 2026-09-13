import React, { useState, useMemo } from 'react';
import { Filter, Trash2, Plus, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';
import { DataCleaningEngine } from '../../../utils/dataCleaningEngine';

interface MissingValuesTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const MissingValuesTab: React.FC<MissingValuesTabProps> = ({ dataset, onAddStep }) => {
  const [activeAction, setActiveAction] = useState<'remove' | 'fill'>('remove');

  // Remove configuration
  const [removeScope, setRemoveScope] = useState<'all_columns' | 'selected_columns'>('all_columns');
  const [selectedRemoveCols, setSelectedRemoveCols] = useState<string[]>([]);
  const [removeStrategy, setRemoveStrategy] = useState<'any' | 'all'>('any');

  // Fill configuration
  const [fillColumn, setFillColumn] = useState<string>(dataset.columns[0]?.name || '');
  const [fillStrategy, setFillStrategy] = useState<'custom' | 'mean' | 'median' | 'mode' | 'zero' | 'ffill' | 'bfill'>('zero');
  const [customFillValue, setCustomFillValue] = useState<string>('');

  const selectedColMeta = useMemo(() => {
    return dataset.columns.find(c => c.name === fillColumn);
  }, [dataset.columns, fillColumn]);

  const isColNumeric = selectedColMeta?.dataType === 'integer' || selectedColMeta?.dataType === 'numeric';

  // Calculate missing counts for each column
  const columnMissingStats = useMemo(() => {
    const stats: Record<string, { count: number; percentage: number }> = {};
    const rows = dataset.previewRows || [];
    const total = rows.length;

    for (const col of dataset.columns) {
      let missingCount = 0;
      for (const row of rows) {
        if (DataCleaningEngine.isMissing(row[col.name])) {
          missingCount++;
        }
      }
      stats[col.name] = {
        count: missingCount,
        percentage: total > 0 ? Math.round((missingCount / total) * 1000) / 10 : 0
      };
    }
    return stats;
  }, [dataset]);

  // Affected row estimate for remove
  const estimatedRemoveCount = useMemo(() => {
    const rows = dataset.previewRows || [];
    const targetCols = removeScope === 'all_columns' ? dataset.columns.map(c => c.name) : selectedRemoveCols;
    if (targetCols.length === 0) return 0;

    let affected = 0;
    for (const r of rows) {
      if (removeStrategy === 'all') {
        if (targetCols.every(c => DataCleaningEngine.isMissing(r[c]))) affected++;
      } else {
        if (targetCols.some(c => DataCleaningEngine.isMissing(r[c]))) affected++;
      }
    }
    return affected;
  }, [dataset, removeScope, selectedRemoveCols, removeStrategy]);

  // Affected row estimate for fill
  const estimatedFillCount = useMemo(() => {
    if (!fillColumn) return 0;
    return columnMissingStats[fillColumn]?.count || 0;
  }, [fillColumn, columnMissingStats]);

  const handleAddRemoveStep = () => {
    const targetCols = removeScope === 'all_columns' ? [] : selectedRemoveCols;
    const desc = targetCols.length > 0
      ? `Remove rows where ${removeStrategy === 'all' ? 'ALL' : 'ANY'} of [${targetCols.join(', ')}] is missing`
      : `Remove rows with ${removeStrategy === 'all' ? 'ALL' : 'ANY'} missing values`;

    const step: TransformStep = {
      id: `step_${Date.now()}_remove_missing`,
      type: 'REMOVE_MISSING',
      description: desc,
      params: {
        columns: targetCols,
        strategy: removeStrategy
      },
      enabled: true,
      createdAt: new Date().toISOString()
    };

    onAddStep(step);
  };

  const handleAddFillStep = () => {
    if (!fillColumn) return;

    let desc = `Fill missing in "${fillColumn}" with `;
    if (fillStrategy === 'custom') desc += `"${customFillValue}"`;
    else if (fillStrategy === 'mean') desc += 'column mean';
    else if (fillStrategy === 'median') desc += 'column median';
    else if (fillStrategy === 'mode') desc += 'most frequent value (mode)';
    else if (fillStrategy === 'zero') desc += '0';
    else if (fillStrategy === 'ffill') desc += 'forward fill';
    else if (fillStrategy === 'bfill') desc += 'backward fill';

    const step: TransformStep = {
      id: `step_${Date.now()}_fill_missing`,
      type: 'FILL_MISSING',
      column: fillColumn,
      description: desc,
      params: {
        column: fillColumn,
        strategy: fillStrategy,
        customValue: isColNumeric ? Number(customFillValue) || 0 : customFillValue
      },
      enabled: true,
      createdAt: new Date().toISOString()
    };

    onAddStep(step);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Action Toggle */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveAction('remove')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
            activeAction === 'remove'
              ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Remove Missing Rows</span>
        </button>
        <button
          onClick={() => setActiveAction('fill')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
            activeAction === 'fill'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Impute / Fill Values</span>
        </button>
      </div>

      {/* Column Missing Health Breakdown */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Missing Value Distribution By Column
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
          {dataset.columns.map(col => {
            const stat = columnMissingStats[col.name] || { count: 0, percentage: 0 };
            const hasMissing = stat.count > 0;
            return (
              <div
                key={col.name}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  hasMissing
                    ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="truncate">
                  <span className="font-mono font-medium text-white">{col.name}</span>
                  <span className="text-[10px] text-slate-500 ml-1.5 font-mono">({col.dataType})</span>
                </div>
                <div className="text-right flex-shrink-0 font-mono">
                  {hasMissing ? (
                    <span className="text-amber-400 font-semibold">{stat.count} missing ({stat.percentage}%)</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">0 missing</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeAction === 'remove' ? (
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Configure Row Deletion</span>
          </h4>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Column Scope</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="removeScope"
                    checked={removeScope === 'all_columns'}
                    onChange={() => setRemoveScope('all_columns')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>All Columns</span>
                </label>
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="removeScope"
                    checked={removeScope === 'selected_columns'}
                    onChange={() => setRemoveScope('selected_columns')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>Selected Columns Only</span>
                </label>
              </div>
            </div>

            {removeScope === 'selected_columns' && (
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1.5">Choose target columns</label>
                <div className="flex flex-wrap gap-2">
                  {dataset.columns.map(col => {
                    const checked = selectedRemoveCols.includes(col.name);
                    return (
                      <button
                        key={col.name}
                        onClick={() => {
                          setSelectedRemoveCols(prev =>
                            checked ? prev.filter(c => c !== col.name) : [...prev, col.name]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                          checked
                            ? 'bg-rose-600 text-white font-semibold'
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
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Condition</label>
              <select
                value={removeStrategy}
                onChange={e => setRemoveStrategy(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-hidden"
              >
                <option value="any">Remove row if ANY selected column is missing</option>
                <option value="all">Remove row only if ALL selected columns are missing</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Estimated rows affected: <span className="text-rose-400 font-mono font-bold">{estimatedRemoveCount} rows</span>
            </div>
            <button
              onClick={handleAddRemoveStep}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Remove Step to Pipeline</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Configure Imputation / Fill Rule</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Target Column</label>
              <select
                value={fillColumn}
                onChange={e => setFillColumn(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono focus:outline-hidden"
              >
                {dataset.columns.map(col => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.dataType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Imputation Strategy</label>
              <select
                value={fillStrategy}
                onChange={e => setFillStrategy(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-hidden"
              >
                {isColNumeric ? (
                  <>
                    <option value="zero">Fill with Zero (0)</option>
                    <option value="mean">Fill with Column Mean</option>
                    <option value="median">Fill with Column Median</option>
                    <option value="mode">Fill with Mode (Most Frequent)</option>
                    <option value="ffill">Forward Fill (ffill)</option>
                    <option value="bfill">Backward Fill (bfill)</option>
                    <option value="custom">Custom Numeric Value</option>
                  </>
                ) : (
                  <>
                    <option value="custom">Fill with Custom Text</option>
                    <option value="mode">Fill with Mode (Most Frequent)</option>
                    <option value="ffill">Forward Fill (ffill)</option>
                    <option value="bfill">Backward Fill (bfill)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {fillStrategy === 'custom' && (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Custom Fill Value</label>
              <input
                type={isColNumeric ? 'number' : 'text'}
                value={customFillValue}
                onChange={e => setCustomFillValue(e.target.value)}
                placeholder={isColNumeric ? '0' : 'e.g. Unknown / None'}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-hidden font-mono"
              />
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Estimated missing cells filled: <span className="text-indigo-400 font-mono font-bold">{estimatedFillCount} cells</span>
            </div>
            <button
              onClick={handleAddFillStep}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Fill Step to Pipeline</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
