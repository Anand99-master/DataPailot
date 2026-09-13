import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Plus,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Code2,
  Sparkles,
  Eye,
  Info
} from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';
import { ExpressionEngine } from '../../../utils/expressionEngine';

interface CalculatedColumnTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const CalculatedColumnTab: React.FC<CalculatedColumnTabProps> = ({ dataset, onAddStep }) => {
  const [newColumnName, setNewColumnName] = useState('');
  const [expression, setExpression] = useState('');
  const [resultType, setResultType] = useState<'numeric' | 'text' | 'boolean'>('numeric');

  const columnNames = useMemo(() => dataset.columns.map(c => c.name), [dataset]);
  const sampleRows = useMemo(() => dataset.previewRows || [], [dataset]);

  // Real-time validation
  const validation = useMemo(() => {
    if (!expression.trim()) {
      return { valid: false, error: 'Please enter a formula expression.', referencedColumns: [] };
    }
    return ExpressionEngine.validate(expression, columnNames);
  }, [expression, columnNames]);

  // Live evaluation on sample rows
  const previewResults = useMemo(() => {
    if (!validation.valid || !validation.ast || sampleRows.length === 0) return [];
    return sampleRows.slice(0, 5).map(row => {
      try {
        const val = ExpressionEngine.evaluate(validation.ast!, row);
        return { row, val, error: null };
      } catch (err: any) {
        return { row, val: null, error: err.message };
      }
    });
  }, [validation, sampleRows]);

  const insertToken = (token: string) => {
    setExpression(prev => {
      if (!prev) return token;
      return `${prev} ${token}`;
    });
  };

  const handleAddStep = () => {
    if (!newColumnName.trim() || !expression.trim() || !validation.valid) return;

    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'CALCULATED_COLUMN',
      column: newColumnName.trim(),
      description: `Create calculated column "${newColumnName.trim()}" = ${expression.trim()}`,
      params: {
        newColumnName: newColumnName.trim(),
        expression: expression.trim(),
        resultType
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });

    setNewColumnName('');
    setExpression('');
  };

  const formulaPresets = [
    { label: 'Profit', formula: 'Sales - Cost' },
    { label: 'Profit Margin %', formula: 'ROUND((Sales - Cost) / Sales * 100, 2)' },
    { label: 'Total Value', formula: 'Quantity * Unit_Price' },
    { label: 'Full Name', formula: 'CONCAT(First_Name, " ", Last_Name)' },
    { label: 'High Value Flag', formula: 'IF(Sales >= 1000, "High", "Standard")' },
    { label: 'Coalesce Nulls', formula: 'COALESCE(Discount, 0)' }
  ];

  return (
    <div className="space-y-6" id="calculated-column-tab">
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Calculated Column Builder</h4>
              <p className="text-xs text-slate-400">
                Create new columns computed with safe mathematical, string, and logical expressions.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            AST Safe Engine (Zero eval)
          </span>
        </div>

        {/* Input parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">New Column Name</label>
            <input
              id="input-calc-col-name"
              type="text"
              value={newColumnName}
              onChange={e => setNewColumnName(e.target.value)}
              placeholder="e.g. Profit_Margin, Total_Amount, Full_Address"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Result Type</label>
            <select
              value={resultType}
              onChange={e => setResultType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
            >
              <option value="numeric">Numeric (Integer/Decimal)</option>
              <option value="text">Text (String)</option>
              <option value="boolean">Boolean (True/False)</option>
            </select>
          </div>
        </div>

        {/* Expression Editor */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">Formula Expression</label>
            {validation.valid ? (
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Formula syntax valid
              </span>
            ) : expression ? (
              <span className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {validation.error}
              </span>
            ) : null}
          </div>
          <textarea
            id="textarea-calc-expression"
            rows={3}
            value={expression}
            onChange={e => setExpression(e.target.value)}
            placeholder="e.g. Sales - Cost or ROUND((Sales - Cost) / Sales * 100, 2)"
            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-indigo-200 font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Quick Insert Column Pills */}
        <div>
          <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Click to Insert Column Reference
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-slate-800">
            {dataset.columns.map(col => (
              <button
                key={col.name}
                type="button"
                onClick={() => insertToken(`[${col.name}]`)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-indigo-300 border border-slate-700 hover:border-indigo-500/60 transition-all"
              >
                [{col.name}]
              </button>
            ))}
          </div>
        </div>

        {/* Quick Math & Logic Operator Helpers */}
        <div>
          <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Quick Operators & Functions
          </span>
          <div className="flex flex-wrap gap-1.5">
            {['+', '-', '*', '/', '%', '^', '(', ')', '==', '!=', '>', '<', '>=', '<=', 'AND', 'OR'].map(op => (
              <button
                key={op}
                type="button"
                onClick={() => insertToken(op)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 transition-all"
              >
                {op}
              </button>
            ))}
            {['IF()', 'ROUND()', 'ABS()', 'COALESCE()', 'CONCAT()', 'UPPER()', 'LOWER()', 'TRIM()', 'MIN()', 'MAX()'].map(fn => (
              <button
                key={fn}
                type="button"
                onClick={() => insertToken(fn)}
                className="px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900/60 text-xs font-mono text-indigo-300 border border-indigo-800/60 transition-all"
              >
                {fn}
              </button>
            ))}
          </div>
        </div>

        {/* Common Formula Presets */}
        <div>
          <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Formula Templates
          </span>
          <div className="flex flex-wrap gap-2">
            {formulaPresets.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  if (!newColumnName) setNewColumnName(preset.label.replace(/[^a-zA-Z0-9_]/g, '_'));
                  setExpression(preset.formula);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
              >
                <Code2 className="w-3 h-3 text-indigo-400" />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Evaluation Preview */}
        {previewResults.length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                Live Evaluation on Sample Records
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {newColumnName ? `Computed [${newColumnName}]` : 'Computed Result'}
              </span>
            </div>
            <div className="overflow-x-auto max-h-40">
              <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2">Row #</th>
                    {validation.referencedColumns.slice(0, 3).map(col => (
                      <th key={col} className="p-2 whitespace-nowrap">{col}</th>
                    ))}
                    <th className="p-2 bg-indigo-950/40 text-indigo-300 font-bold">
                      ➔ {newColumnName || 'Result'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                  {previewResults.map((pr, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td className="p-2 text-slate-500">#{idx + 1}</td>
                      {validation.referencedColumns.slice(0, 3).map(col => (
                        <td key={col} className="p-2 text-slate-400">
                          {String(pr.row[col] ?? '')}
                        </td>
                      ))}
                      <td className="p-2 bg-indigo-950/20 text-emerald-300 font-bold">
                        {pr.val === null ? <span className="text-slate-600">null</span> : String(pr.val)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            id="btn-add-calculated-step"
            onClick={handleAddStep}
            disabled={!newColumnName.trim() || !expression.trim() || !validation.valid}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Calculated Column Step
          </button>
        </div>
      </div>
    </div>
  );
};
