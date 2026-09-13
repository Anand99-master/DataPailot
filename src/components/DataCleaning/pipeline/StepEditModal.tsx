import React, { useState } from 'react';
import { X, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TransformStep } from '../../../types/cleaning';
import { ColumnMetadata } from '../../../types/import';
import { ExpressionEngine } from '../../../utils/expressionEngine';

interface StepEditModalProps {
  step: TransformStep;
  columns: ColumnMetadata[];
  onSave: (updatedStep: TransformStep) => void;
  onClose: () => void;
}

export const StepEditModal: React.FC<StepEditModalProps> = ({
  step,
  columns,
  onSave,
  onClose
}) => {
  const [description, setDescription] = useState(step.description);
  const [params, setParams] = useState<any>(JSON.parse(JSON.stringify(step.params || {})));
  const [error, setError] = useState<string | null>(null);

  const handleParamChange = (key: string, value: any) => {
    setParams((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation checks based on type
    if (step.type === 'CALCULATED_COLUMN') {
      const expr = params.expression?.trim();
      if (!expr) {
        setError('Formula expression is required.');
        return;
      }
      const val = ExpressionEngine.validate(expr, columns.map(c => c.name));
      if (!val.valid) {
        setError(val.error || 'Invalid formula expression.');
        return;
      }
    }

    if (step.type === 'RENAME_COLUMN') {
      if (!params.newName?.trim()) {
        setError('New column name is required.');
        return;
      }
    }

    const updated: TransformStep = {
      ...step,
      description: description.trim() || step.description,
      params,
      column: params.column || params.oldName || params.sourceColumn || step.column
    };

    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Edit Transformation Step</h3>
            <p className="text-xs text-indigo-400 font-mono mt-0.5">{step.type}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-900 text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Step Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500"
              placeholder="Human-readable step description"
            />
          </div>

          {/* Dynamic parameter controls according to step.type */}
          {params.column !== undefined && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Column</label>
              <select
                value={params.column || ''}
                onChange={e => handleParamChange('column', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
              >
                <option value="">Select column...</option>
                {columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dataType})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* RENAME_COLUMN */}
          {step.type === 'RENAME_COLUMN' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Original Column</label>
                <select
                  value={params.oldName || ''}
                  onChange={e => handleParamChange('oldName', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  {columns.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Column Name</label>
                <input
                  type="text"
                  value={params.newName || ''}
                  onChange={e => handleParamChange('newName', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* CALCULATED_COLUMN */}
          {step.type === 'CALCULATED_COLUMN' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Column Name</label>
                <input
                  type="text"
                  value={params.newColumnName || ''}
                  onChange={e => handleParamChange('newColumnName', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Formula Expression</label>
                <input
                  type="text"
                  value={params.expression || ''}
                  onChange={e => handleParamChange('expression', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-indigo-300 font-mono focus:outline-hidden focus:border-indigo-500"
                  placeholder="e.g. Sales * (1 - Discount)"
                />
              </div>
            </div>
          )}

          {/* CONVERT_TYPE */}
          {step.type === 'CONVERT_TYPE' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Data Type</label>
              <select
                value={params.targetType || 'text'}
                onChange={e => handleParamChange('targetType', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500"
              >
                <option value="text">Text / String</option>
                <option value="numeric">Numeric / Float</option>
                <option value="integer">Integer</option>
                <option value="date">Date</option>
                <option value="boolean">Boolean</option>
              </select>
            </div>
          )}

          {/* FILL_MISSING */}
          {step.type === 'FILL_MISSING' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Strategy</label>
                <select
                  value={params.strategy || 'custom'}
                  onChange={e => handleParamChange('strategy', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="custom">Custom Value</option>
                  <option value="mean">Mean (Average)</option>
                  <option value="median">Median</option>
                  <option value="mode">Mode (Most Frequent)</option>
                  <option value="zero">Zero (0)</option>
                  <option value="ffill">Forward Fill</option>
                  <option value="bfill">Backward Fill</option>
                </select>
              </div>
              {params.strategy === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Value</label>
                  <input
                    type="text"
                    value={params.customValue ?? ''}
                    onChange={e => handleParamChange('customValue', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* JSON raw parameter inspection fallback */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Step Parameters (JSON)</label>
            <textarea
              rows={4}
              value={JSON.stringify(params, null, 2)}
              onChange={e => {
                try {
                  const p = JSON.parse(e.target.value);
                  setParams(p);
                  setError(null);
                } catch {
                  // Keep typing
                }
              }}
              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
