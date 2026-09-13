import React, { useState, useMemo } from 'react';
import { RefreshCw, Plus, Trash2, ArrowRight, Wand2, Check } from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';

interface ValueMappingTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const ValueMappingTab: React.FC<ValueMappingTabProps> = ({ dataset, onAddStep }) => {
  const [selectedColumn, setSelectedColumn] = useState<string>(dataset.columns[0]?.name || '');

  // Default common sentinel values to map to NULL
  const [mappings, setMappings] = useState<{ from: string; to: string | null }[]>([
    { from: 'N/A', to: null },
    { from: 'NA', to: null },
    { from: 'n/a', to: null },
    { from: 'null', to: null },
    { from: 'NULL', to: null },
    { from: 'None', to: null },
    { from: 'Unknown', to: null },
    { from: '-', to: null },
    { from: '?', to: null }
  ]);

  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newIsToNull, setNewIsToNull] = useState(true);

  // Compute occurrences in preview rows
  const occurrences = useMemo(() => {
    if (!selectedColumn) return {};
    const rows = dataset.previewRows || [];
    const counts: Record<string, number> = {};

    rows.forEach(r => {
      const v = r[selectedColumn];
      if (v !== null && v !== undefined) {
        const str = String(v).trim();
        counts[str.toLowerCase()] = (counts[str.toLowerCase()] || 0) + 1;
      }
    });

    return counts;
  }, [dataset.previewRows, selectedColumn]);

  const handleAddMapping = () => {
    if (!newFrom) return;
    setMappings(prev => [...prev, { from: newFrom, to: newIsToNull ? null : newTo }]);
    setNewFrom('');
    setNewTo('');
  };

  const handleRemoveMapping = (idx: number) => {
    setMappings(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddStep = () => {
    if (!selectedColumn || mappings.length === 0) return;

    const desc = `Map ${mappings.length} sentinel values in "${selectedColumn}" (e.g. N/A -> NULL)`;

    const step: TransformStep = {
      id: `step_${Date.now()}_map_values`,
      type: 'MAP_VALUES',
      column: selectedColumn,
      description: desc,
      params: {
        column: selectedColumn,
        mappings
      },
      enabled: true,
      createdAt: new Date().toISOString()
    };

    onAddStep(step);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-5">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-purple-400" />
          <span>Value Standardization & Sentinel Mapping</span>
        </h4>

        {/* Column Selection */}
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1.5">Target Column</label>
          <select
            value={selectedColumn}
            onChange={e => setSelectedColumn(e.target.value)}
            className="w-full max-w-md px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono focus:outline-hidden"
          >
            {dataset.columns.map(c => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.dataType})
              </option>
            ))}
          </select>
        </div>

        {/* Add custom mapping rule */}
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Add Value Replacement Rule
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Source value (e.g. Unknown)"
              value={newFrom}
              onChange={e => setNewFrom(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-hidden font-mono"
            />
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <label className="flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsToNull}
                onChange={e => setNewIsToNull(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span>Set to NULL</span>
            </label>
            {!newIsToNull && (
              <input
                type="text"
                placeholder="Target value (e.g. Standard)"
                value={newTo}
                onChange={e => setNewTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-hidden font-mono"
              />
            )}
            <button
              onClick={handleAddMapping}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
            >
              + Add Rule
            </button>
          </div>
        </div>

        {/* Mappings List with Occurrence Badges */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Active Value Mappings ({mappings.length})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {mappings.map((m, idx) => {
              const matchedCount = occurrences[m.from.trim().toLowerCase()] || 0;
              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between font-mono ${
                    matchedCount > 0
                      ? 'bg-purple-950/20 border-purple-800/40 text-purple-200'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="font-semibold text-white">&quot;{m.from}&quot;</span>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <span className={m.to === null ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                      {m.to === null ? 'NULL' : `"${m.to}"`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {matchedCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-purple-900/60 text-[10px] text-purple-200 font-bold">
                        {matchedCount} found
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveMapping(idx)}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAddStep}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Value Standardization Step to Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
