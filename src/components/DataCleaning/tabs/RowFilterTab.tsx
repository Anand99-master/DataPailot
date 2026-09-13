import React, { useState, useMemo } from 'react';
import {
  Filter,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Rows
} from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep, FilterCondition, FilterOperator } from '../../../types/cleaning';
import { DataCleaningEngine } from '../../../utils/dataCleaningEngine';

interface RowFilterTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const RowFilterTab: React.FC<RowFilterTabProps> = ({ dataset, onAddStep }) => {
  const defaultCol = dataset.columns[0]?.name || '';

  const [action, setAction] = useState<'keep' | 'remove'>('keep');
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<FilterCondition[]>([
    {
      column: defaultCol,
      operator: 'greater_than',
      value: '0'
    }
  ]);

  const sampleRows = useMemo(() => dataset.previewRows || [], [dataset]);

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      {
        column: defaultCol,
        operator: 'equals',
        value: ''
      }
    ]);
  };

  const handleRemoveCondition = (idx: number) => {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const handleUpdateCondition = (idx: number, updates: Partial<FilterCondition>) => {
    setConditions(conditions.map((c, i) => (i === idx ? { ...c, ...updates } : c)));
  };

  // Preview filtering on sample rows
  const filteredSample = useMemo(() => {
    return DataCleaningEngine.filterRows(sampleRows, {
      action,
      logic,
      conditions
    });
  }, [sampleRows, action, logic, conditions]);

  const handleAddStep = () => {
    const desc = `${action === 'keep' ? 'Keep' : 'Remove'} rows matching ${conditions.length} condition(s) (${logic})`;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'FILTER_ROWS',
      description: desc,
      params: {
        action,
        logic,
        conditions
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  const operators: { value: FilterOperator; label: string }[] = [
    { value: 'equals', label: 'equals (=)' },
    { value: 'not_equals', label: 'does not equal (!=)' },
    { value: 'greater_than', label: 'greater than (>)' },
    { value: 'greater_equal', label: 'greater than or equal (>=)' },
    { value: 'less_than', label: 'less than (<)' },
    { value: 'less_equal', label: 'less than or equal (<=)' },
    { value: 'contains', label: 'contains text' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'between', label: 'is between (range)' },
    { value: 'in_list', label: 'is in list (comma-separated)' },
    { value: 'is_null', label: 'is blank / null' },
    { value: 'is_not_null', label: 'is not blank' }
  ];

  return (
    <div className="space-y-6" id="row-filter-tab">
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-amber-400" />
          <div>
            <h4 className="text-sm font-semibold text-white">Row Filtering & Conditional Removal</h4>
            <p className="text-xs text-slate-400">
              Filter rows by specific value thresholds, date boundaries, status strings, or null checks.
            </p>
          </div>
        </div>

        {/* Action & Logic Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Filter Action</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAction('keep')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  action === 'keep'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Keep Matching Rows
              </button>
              <button
                type="button"
                onClick={() => setAction('remove')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  action === 'remove'
                    ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Remove Matching Rows
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Condition Logic Combination</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLogic('AND')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  logic === 'AND'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Match ALL Conditions (AND)
              </button>
              <button
                type="button"
                onClick={() => setLogic('OR')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  logic === 'OR'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Match ANY Condition (OR)
              </button>
            </div>
          </div>
        </div>

        {/* Condition Rows */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">Filter Conditions</label>
          {conditions.map((cond, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
            >
              <div className="sm:col-span-3">
                <select
                  value={cond.column}
                  onChange={e => handleUpdateCondition(idx, { column: e.target.value })}
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
                  value={cond.operator}
                  onChange={e => handleUpdateCondition(idx, { operator: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200"
                >
                  {operators.map(op => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              {cond.operator === 'between' ? (
                <div className="sm:col-span-5 flex items-center gap-2">
                  <input
                    type="text"
                    value={String(cond.value ?? '')}
                    onChange={e => handleUpdateCondition(idx, { value: e.target.value })}
                    placeholder="Min value"
                    className="w-1/2 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <span className="text-xs text-slate-500">and</span>
                  <input
                    type="text"
                    value={String(cond.value2 ?? '')}
                    onChange={e => handleUpdateCondition(idx, { value2: e.target.value })}
                    placeholder="Max value"
                    className="w-1/2 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              ) : !['is_null', 'is_not_null'].includes(cond.operator) ? (
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    value={String(cond.value ?? '')}
                    onChange={e => handleUpdateCondition(idx, { value: e.target.value })}
                    placeholder={cond.operator === 'in_list' ? 'Val1, Val2, Val3...' : 'Value to match'}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              ) : (
                <div className="sm:col-span-5 text-xs text-slate-500 italic">No value needed for null checks</div>
              )}

              <div className="sm:col-span-1 flex justify-end">
                {conditions.length > 1 && (
                  <button
                    onClick={() => handleRemoveCondition(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddCondition}
            className="text-xs text-slate-400 hover:text-amber-400 font-medium flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Another Condition ({logic})
          </button>
        </div>

        {/* Impact preview badge */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Rows className="w-4 h-4 text-amber-400" />
            <span className="text-slate-300">
              Sample Impact:{' '}
              <strong className="text-white">{filteredSample.length}</strong> of{' '}
              <strong className="text-white">{sampleRows.length}</strong> sample rows retained
            </span>
          </div>
          <span className="text-slate-500 text-[11px]">
            {action === 'keep' ? 'Keeps' : 'Removes'} rows matching filter
          </span>
        </div>

        <div className="flex justify-end pt-2">
          <button
            id="btn-add-filter-step"
            onClick={handleAddStep}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Filter Step
          </button>
        </div>
      </div>
    </div>
  );
};
