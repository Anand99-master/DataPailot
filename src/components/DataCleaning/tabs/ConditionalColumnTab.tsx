import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  Plus,
  Trash2,
  CheckCircle2,
  Eye,
  Sliders,
  Sparkles
} from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep, ConditionalRule, ConditionItem, FilterOperator } from '../../../types/cleaning';

interface ConditionalColumnTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const ConditionalColumnTab: React.FC<ConditionalColumnTabProps> = ({ dataset, onAddStep }) => {
  const [newColumnName, setNewColumnName] = useState('');
  const defaultCol = dataset.columns[0]?.name || '';

  const [rules, setRules] = useState<ConditionalRule[]>([
    {
      id: 'rule_1',
      logic: 'AND',
      conditions: [{ column: defaultCol, operator: 'greater_than', value: '100' }],
      thenValue: 'Tier A',
      thenType: 'string'
    }
  ]);

  const [elseValue, setElseValue] = useState('Standard');
  const [elseType, setElseType] = useState<'string' | 'number' | 'boolean' | 'null'>('string');

  const sampleRows = useMemo(() => dataset.previewRows || [], [dataset]);

  // Add a new IF/ELSE-IF rule block
  const handleAddRule = () => {
    setRules([
      ...rules,
      {
        id: `rule_${Date.now()}`,
        logic: 'AND',
        conditions: [{ column: defaultCol, operator: 'equals', value: '' }],
        thenValue: '',
        thenType: 'string'
      }
    ]);
  };

  // Remove a rule block
  const handleRemoveRule = (ruleId: string) => {
    if (rules.length <= 1) return;
    setRules(rules.filter(r => r.id !== ruleId));
  };

  // Update rule fields
  const handleUpdateRule = (ruleId: string, updates: Partial<ConditionalRule>) => {
    setRules(rules.map(r => (r.id === ruleId ? { ...r, ...updates } : r)));
  };

  // Add sub-condition within a rule
  const handleAddCondition = (ruleId: string) => {
    setRules(
      rules.map(r => {
        if (r.id === ruleId) {
          return {
            ...r,
            conditions: [...r.conditions, { column: defaultCol, operator: 'equals', value: '' }]
          };
        }
        return r;
      })
    );
  };

  // Remove sub-condition within a rule
  const handleRemoveCondition = (ruleId: string, condIdx: number) => {
    setRules(
      rules.map(r => {
        if (r.id === ruleId && r.conditions.length > 1) {
          return {
            ...r,
            conditions: r.conditions.filter((_, idx) => idx !== condIdx)
          };
        }
        return r;
      })
    );
  };

  // Update a sub-condition item
  const handleUpdateCondition = (ruleId: string, condIdx: number, updates: Partial<ConditionItem>) => {
    setRules(
      rules.map(r => {
        if (r.id === ruleId) {
          const newConds = [...r.conditions];
          newConds[condIdx] = { ...newConds[condIdx], ...updates };
          return { ...r, conditions: newConds };
        }
        return r;
      })
    );
  };

  // Evaluator for preview
  const previewResults = useMemo(() => {
    if (!newColumnName.trim() || sampleRows.length === 0) return [];

    const castVal = (val: unknown, type?: string) => {
      if (val === null || val === undefined) return null;
      if (type === 'number') {
        const n = Number(val);
        return isNaN(n) ? null : n;
      }
      if (type === 'boolean') return Boolean(val);
      return String(val);
    };

    return sampleRows.slice(0, 5).map(row => {
      let matchedVal: unknown = undefined;

      for (const rule of rules) {
        const condResults = rule.conditions.map(c => {
          const rowVal = row[c.column];
          if (c.operator === 'is_null') return rowVal === null || rowVal === undefined || rowVal === '';
          if (c.operator === 'is_not_null') return rowVal !== null && rowVal !== undefined && rowVal !== '';

          if (rowVal === null || rowVal === undefined) return false;

          const n1 = typeof rowVal === 'number' ? rowVal : Number(rowVal);
          const n2 = typeof c.value === 'number' ? c.value : Number(c.value);
          const isNum = !isNaN(n1) && !isNaN(n2) && c.value !== '' && c.value !== undefined;

          const s1 = String(rowVal).toLowerCase();
          const s2 = String(c.value ?? '').toLowerCase();

          switch (c.operator) {
            case 'equals':
              return isNum ? n1 === n2 : s1 === s2;
            case 'not_equals':
              return isNum ? n1 !== n2 : s1 !== s2;
            case 'greater_than':
              return isNum ? n1 > n2 : s1 > s2;
            case 'less_than':
              return isNum ? n1 < n2 : s1 < s2;
            case 'greater_equal':
              return isNum ? n1 >= n2 : s1 >= s2;
            case 'less_equal':
              return isNum ? n1 <= n2 : s1 <= s2;
            case 'contains':
              return s1.includes(s2);
            case 'starts_with':
              return s1.startsWith(s2);
            case 'ends_with':
              return s1.endsWith(s2);
            default:
              return false;
          }
        });

        const isMatch = rule.logic === 'OR' ? condResults.some(Boolean) : condResults.every(Boolean);
        if (isMatch) {
          matchedVal = castVal(rule.thenValue, rule.thenType);
          break;
        }
      }

      if (matchedVal === undefined) {
        matchedVal = castVal(elseValue, elseType);
      }

      return { row, val: matchedVal };
    });
  }, [newColumnName, rules, elseValue, elseType, sampleRows]);

  const handleAddStep = () => {
    if (!newColumnName.trim()) return;

    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'CONDITIONAL_COLUMN',
      column: newColumnName.trim(),
      description: `Create conditional column "${newColumnName.trim()}" with ${rules.length} rule(s)`,
      params: {
        newColumnName: newColumnName.trim(),
        rules,
        elseValue,
        elseType
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });

    setNewColumnName('');
  };

  const operators: { value: FilterOperator; label: string }[] = [
    { value: 'equals', label: 'equals (=)' },
    { value: 'not_equals', label: 'does not equal (!=)' },
    { value: 'greater_than', label: 'greater than (>)' },
    { value: 'greater_equal', label: 'greater than or equal (>=)' },
    { value: 'less_than', label: 'less than (<)' },
    { value: 'less_equal', label: 'less than or equal (<=)' },
    { value: 'contains', label: 'contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'is_null', label: 'is blank / null' },
    { value: 'is_not_null', label: 'is not blank' }
  ];

  return (
    <div className="space-y-6" id="conditional-column-tab">
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-emerald-400" />
          <div>
            <h4 className="text-sm font-semibold text-white">Visual Conditional Column Builder</h4>
            <p className="text-xs text-slate-400">
              Create category labels, scoring brackets, or flags with visual IF - THEN - ELSE rule logic.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">New Column Name</label>
          <input
            id="input-conditional-col-name"
            type="text"
            value={newColumnName}
            onChange={e => setNewColumnName(e.target.value)}
            placeholder="e.g. Customer_Tier, Risk_Level, Fulfillment_Status"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
          />
        </div>

        {/* Rule Blocks List */}
        <div className="space-y-4">
          {rules.map((rule, rIdx) => (
            <div key={rule.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  {rIdx === 0 ? 'IF (Clause 1)' : `ELSE IF (Clause ${rIdx + 1})`}
                </span>
                {rules.length > 1 && (
                  <button
                    onClick={() => handleRemoveRule(rule.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Conditions in this rule */}
              <div className="space-y-2">
                {rule.conditions.map((cond, cIdx) => (
                  <div key={cIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    {cIdx > 0 && (
                      <div className="sm:col-span-2">
                        <select
                          value={rule.logic}
                          onChange={e => handleUpdateRule(rule.id, { logic: e.target.value as any })}
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-amber-300 font-bold"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      </div>
                    )}
                    <div className={cIdx > 0 ? 'sm:col-span-3' : 'sm:col-span-4'}>
                      <select
                        value={cond.column}
                        onChange={e => handleUpdateCondition(rule.id, cIdx, { column: e.target.value })}
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                      >
                        {dataset.columns.map(c => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        value={cond.operator}
                        onChange={e => handleUpdateCondition(rule.id, cIdx, { operator: e.target.value as any })}
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        {operators.map(op => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!['is_null', 'is_not_null'].includes(cond.operator) && (
                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          value={String(cond.value ?? '')}
                          onChange={e => handleUpdateCondition(rule.id, cIdx, { value: e.target.value })}
                          placeholder="Comparison value"
                          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                    )}
                    <div className="sm:col-span-1 flex justify-end">
                      {rule.conditions.length > 1 && (
                        <button
                          onClick={() => handleRemoveCondition(rule.id, cIdx)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => handleAddCondition(rule.id)}
                  className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add sub-condition ({rule.logic})
                </button>
              </div>

              {/* THEN Output Value */}
              <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-emerald-300 uppercase">THEN Output:</span>
                <input
                  type="text"
                  value={String(rule.thenValue ?? '')}
                  onChange={e => handleUpdateRule(rule.id, { thenValue: e.target.value })}
                  placeholder="Output Value"
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-emerald-200 font-medium flex-1 min-w-[140px]"
                />
                <select
                  value={rule.thenType || 'string'}
                  onChange={e => handleUpdateRule(rule.id, { thenType: e.target.value as any })}
                  className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300"
                >
                  <option value="string">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>
            </div>
          ))}

          {/* Add another ELSE IF rule */}
          <button
            type="button"
            onClick={handleAddRule}
            className="w-full py-2 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl text-xs font-medium text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Another ELSE IF Rule
          </button>

          {/* Default ELSE block */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-amber-400 uppercase">ELSE (Default Output):</span>
            <input
              type="text"
              value={elseValue}
              onChange={e => setElseValue(e.target.value)}
              placeholder="Fallback value if no rules match"
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-amber-200 flex-1 min-w-[160px]"
            />
            <select
              value={elseType}
              onChange={e => setElseType(e.target.value as any)}
              className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300"
            >
              <option value="string">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="null">Null / Blank</option>
            </select>
          </div>
        </div>

        {/* Live preview table */}
        {previewResults.length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              Live Evaluation on First 5 Sample Records
            </span>
            <div className="overflow-x-auto max-h-40">
              <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2">Row #</th>
                    {dataset.columns.slice(0, 3).map(c => (
                      <th key={c.name} className="p-2">{c.name}</th>
                    ))}
                    <th className="p-2 bg-emerald-950/40 text-emerald-300 font-bold">
                      ➔ {newColumnName || 'Conditional Result'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                  {previewResults.map((pr, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td className="p-2 text-slate-500">#{idx + 1}</td>
                      {dataset.columns.slice(0, 3).map(c => (
                        <td key={c.name} className="p-2 text-slate-400">
                          {String(pr.row[c.name] ?? '')}
                        </td>
                      ))}
                      <td className="p-2 bg-emerald-950/20 text-emerald-300 font-bold">
                        {String(pr.val ?? 'null')}
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
            id="btn-add-conditional-step"
            onClick={handleAddStep}
            disabled={!newColumnName.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Conditional Column Step
          </button>
        </div>
      </div>
    </div>
  );
};
