import React, { useState } from 'react';
import {
  Filter,
  Plus,
  X,
  Calendar,
  Layers,
  ChevronDown,
  RotateCcw,
  Check
} from 'lucide-react';
import { DashboardFilter } from '../../types/dashboard';

interface DashboardFilterBarProps {
  filters: DashboardFilter[];
  onUpdateFilter: (filterId: string, value: any, dateFrom?: string, dateTo?: string) => void;
  onAddFilter: (newFilter: DashboardFilter) => void;
  onRemoveFilter: (filterId: string) => void;
  onClearAllFilters: () => void;
  crossFilterActive?: { column: string; value: string } | null;
  onClearCrossFilter?: () => void;
}

export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
  filters,
  onUpdateFilter,
  onAddFilter,
  onRemoveFilter,
  onClearAllFilters,
  crossFilterActive,
  onClearCrossFilter
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newTargetCol, setNewTargetCol] = useState('');
  const [newType, setNewType] = useState<DashboardFilter['type']>('text');

  const handleCreateFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newTargetCol.trim()) return;

    const created: DashboardFilter = {
      id: `filter-${Date.now()}`,
      label: newLabel.trim(),
      type: newType,
      targetColumn: newTargetCol.trim(),
      currentValue: newType === 'single_select' ? 'ALL' : ''
    };

    onAddFilter(created);
    setNewLabel('');
    setNewTargetCol('');
    setIsAddModalOpen(false);
  };

  const hasActiveValues = filters.some(f => {
    if (f.type === 'date_range') return Boolean(f.dateFrom || f.dateTo);
    return f.currentValue && f.currentValue !== 'ALL';
  });

  return (
    <div className="w-full bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center space-x-1.5 text-slate-400 font-medium mr-1 select-none">
          <Filter className="w-3.5 h-3.5 text-emerald-400" />
          <span>Filters:</span>
        </div>

        {/* Existing Filters */}
        {filters.length === 0 && !crossFilterActive && (
          <span className="text-[11px] text-slate-400 italic">
            No dashboard filters configured. Add a filter to scope widgets.
          </span>
        )}

        {filters.map(filter => (
          <div
            key={filter.id}
            className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200"
          >
            <span className="text-[11px] text-slate-400 font-medium">{filter.label}:</span>

            {/* Filter Input based on type */}
            {filter.type === 'text' && (
              <input
                type="text"
                placeholder="Value..."
                value={filter.currentValue || ''}
                onChange={e => onUpdateFilter(filter.id, e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 w-28"
              />
            )}

            {filter.type === 'number' && (
              <input
                type="number"
                placeholder="Number..."
                value={filter.currentValue || ''}
                onChange={e => onUpdateFilter(filter.id, e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 w-24"
              />
            )}

            {filter.type === 'date' && (
              <input
                type="date"
                value={filter.currentValue || ''}
                onChange={e => onUpdateFilter(filter.id, e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            )}

            {filter.type === 'date_range' && (
              <div className="flex items-center space-x-1">
                <input
                  type="date"
                  value={filter.dateFrom || ''}
                  onChange={e => onUpdateFilter(filter.id, filter.currentValue, e.target.value, filter.dateTo)}
                  className="bg-slate-900 border border-slate-700/60 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-slate-400">→</span>
                <input
                  type="date"
                  value={filter.dateTo || ''}
                  onChange={e => onUpdateFilter(filter.id, filter.currentValue, filter.dateFrom, e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {filter.type === 'single_select' && (
              <select
                value={filter.currentValue || 'ALL'}
                onChange={e => onUpdateFilter(filter.id, e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All</option>
                {filter.options?.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => onRemoveFilter(filter.id)}
              className="text-slate-400 hover:text-rose-400 p-0.5"
              title="Remove filter"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Cross-Filtering Banner */}
        {crossFilterActive && (
          <div className="flex items-center space-x-2 bg-emerald-950/60 border border-emerald-700/60 rounded-lg px-2.5 py-1 text-emerald-200 text-xs animate-in fade-in">
            <span>
              Dashboard filtered by: <strong className="text-white">{crossFilterActive.value}</strong> ({crossFilterActive.column})
            </span>
            {onClearCrossFilter && (
              <button
                type="button"
                onClick={onClearCrossFilter}
                className="text-emerald-300 hover:text-white p-0.5"
                title="Clear cross-filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Add Filter Button */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/50 transition-colors text-[11px]"
        >
          <Plus className="w-3 h-3 text-emerald-400" />
          <span>Add Filter</span>
        </button>
      </div>

      {/* Clear All Filters */}
      {(hasActiveValues || crossFilterActive) && (
        <button
          type="button"
          onClick={() => {
            onClearAllFilters();
            onClearCrossFilter?.();
          }}
          className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1 rounded-md transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear Filters</span>
        </button>
      )}

      {/* Quick Add Filter Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateFilter}
            className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-semibold text-white flex items-center space-x-1.5">
                <Filter className="w-4 h-4 text-emerald-400" />
                <span>Configure Dashboard Filter</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Filter Display Label
              </label>
              <input
                type="text"
                placeholder="e.g. Region or Order Date"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Target Database Column
              </label>
              <input
                type="text"
                placeholder="e.g. region or created_at"
                value={newTargetCol}
                onChange={e => setNewTargetCol(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Must match a column name returned by the widget queries.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Filter Input Type
              </label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="text">Text (Exact / Case)</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="date_range">Date Range (From → To)</option>
                <option value="single_select">Single Select</option>
              </select>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
              >
                Add Filter
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
