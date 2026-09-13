import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  Trophy,
  Plus,
  Trash2,
  CheckCircle2,
  Sliders,
  Eye,
  Layers
} from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep, SortLevel, SortDirection, RankMethod } from '../../../types/cleaning';

interface SortRankTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const SortRankTab: React.FC<SortRankTabProps> = ({ dataset, onAddStep }) => {
  const [activeSection, setActiveSection] = useState<'sort' | 'rank'>('sort');
  const defaultCol = dataset.columns[0]?.name || '';

  // 1. Sort state
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([
    { column: defaultCol, direction: 'ASC', nulls: 'last' }
  ]);

  // 2. Rank state
  const [measureColumn, setMeasureColumn] = useState(defaultCol);
  const [rankColName, setRankColName] = useState(`${defaultCol}_rank`);
  const [rankDirection, setRankDirection] = useState<SortDirection>('DESC');
  const [rankMethod, setRankMethod] = useState<RankMethod>('rank');
  const [partitionBy, setPartitionBy] = useState<string>('none');

  const sampleRows = useMemo(() => dataset.previewRows || [], [dataset]);

  // Sort handlers
  const handleAddSortLevel = () => {
    setSortLevels([
      ...sortLevels,
      { column: defaultCol, direction: 'ASC', nulls: 'last' }
    ]);
  };

  const handleRemoveSortLevel = (idx: number) => {
    if (sortLevels.length <= 1) return;
    setSortLevels(sortLevels.filter((_, i) => i !== idx));
  };

  const handleUpdateSortLevel = (idx: number, updates: Partial<SortLevel>) => {
    setSortLevels(sortLevels.map((l, i) => (i === idx ? { ...l, ...updates } : l)));
  };

  const handleAddSortStep = () => {
    const desc = `Sort by ${sortLevels.map(l => `${l.column} (${l.direction})`).join(', ')}`;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'SORT_ROWS',
      description: desc,
      params: { levels: sortLevels },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  // Rank handler
  const handleAddRankStep = () => {
    if (!measureColumn || !rankColName.trim()) return;
    const desc = `Rank rows by "${measureColumn}" (${rankDirection}, ${rankMethod})${
      partitionBy && partitionBy !== 'none' ? ` partitioned by "${partitionBy}"` : ''
    } → "${rankColName.trim()}"`;

    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'RANK_ROWS',
      column: rankColName.trim(),
      description: desc,
      params: {
        measureColumn,
        targetColumnName: rankColName.trim(),
        direction: rankDirection,
        method: rankMethod,
        partitionBy: partitionBy !== 'none' ? partitionBy : undefined
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6" id="sort-rank-tab">
      {/* Sub-header navigation */}
      <div className="flex gap-2 p-1.5 bg-slate-900/80 rounded-xl border border-slate-800">
        <button
          id="btn-subtab-sort"
          onClick={() => setActiveSection('sort')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'sort'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ArrowUpDown className="w-4 h-4" />
          Multi-Column Sorting
        </button>
        <button
          id="btn-subtab-rank"
          onClick={() => setActiveSection('rank')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'rank'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Grouped Window Ranking
        </button>
      </div>

      {/* 1. Sorting Section */}
      {activeSection === 'sort' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-blue-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Multi-Column Sorting</h4>
              <p className="text-xs text-slate-400">
                Sort records across multiple hierarchical columns with customizable direction and null handling.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {sortLevels.map((lvl, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
              >
                <div className="sm:col-span-1 text-[11px] font-mono text-slate-500">
                  {idx === 0 ? 'Primary' : `Then By`}
                </div>
                <div className="sm:col-span-4">
                  <select
                    value={lvl.column}
                    onChange={e => handleUpdateSortLevel(idx, { column: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    {dataset.columns.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.dataType})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={lvl.direction}
                    onChange={e => handleUpdateSortLevel(idx, { direction: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200"
                  >
                    <option value="ASC">Ascending (A-Z / 1-9)</option>
                    <option value="DESC">Descending (Z-A / 9-1)</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={lvl.nulls || 'last'}
                    onChange={e => handleUpdateSortLevel(idx, { nulls: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300"
                  >
                    <option value="last">Nulls at the end</option>
                    <option value="first">Nulls at the beginning</option>
                  </select>
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  {sortLevels.length > 1 && (
                    <button
                      onClick={() => handleRemoveSortLevel(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddSortLevel}
              className="text-xs text-slate-400 hover:text-blue-400 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Another Sort Level (Then By)
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="btn-add-sort-step"
              onClick={handleAddSortStep}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Sort Step
            </button>
          </div>
        </div>
      )}

      {/* 2. Ranking Section */}
      {activeSection === 'rank' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Grouped Window Ranking</h4>
              <p className="text-xs text-slate-400">
                Calculate rankings, percentiles, or sequential row numbers across partitions or the full dataset.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Measure / Metric Column</label>
              <select
                value={measureColumn}
                onChange={e => {
                  setMeasureColumn(e.target.value);
                  setRankColName(`${e.target.value}_rank`);
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {dataset.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dataType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">New Rank Column Name</label>
              <input
                type="text"
                value={rankColName}
                onChange={e => setRankColName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Ranking Method</label>
              <select
                value={rankMethod}
                onChange={e => setRankMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="rank">Standard Rank (1, 2, 2, 4 with gaps)</option>
                <option value="dense_rank">Dense Rank (1, 2, 2, 3 no gaps)</option>
                <option value="row_number">Row Number (1, 2, 3, 4 strictly unique)</option>
                <option value="percentile">Percentile (0.0 to 100.0%)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Rank Direction</label>
              <select
                value={rankDirection}
                onChange={e => setRankDirection(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="DESC">Highest is #1 (Descending)</option>
                <option value="ASC">Lowest is #1 (Ascending)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Partition / Group By (Optional)
              </label>
              <select
                value={partitionBy}
                onChange={e => setPartitionBy(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="none">None (Rank across entire dataset)</option>
                {dataset.columns
                  .filter(c => c.name !== measureColumn)
                  .map(c => (
                    <option key={c.name} value={c.name}>
                      Group by {c.name}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                When partition is selected, ranks restart at 1 for each distinct group.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="btn-add-rank-step"
              onClick={handleAddRankStep}
              disabled={!measureColumn || !rankColName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Rank Step
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
