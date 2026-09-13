import React, { useState, useMemo } from 'react';
import { Activity, ShieldAlert, Plus, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';

interface OutliersTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const OutliersTab: React.FC<OutliersTabProps> = ({ dataset, onAddStep }) => {
  const numCols = useMemo(() => {
    return dataset.columns.filter(c => c.dataType === 'integer' || c.dataType === 'numeric');
  }, [dataset.columns]);

  const [selectedColumn, setSelectedColumn] = useState<string>(numCols[0]?.name || dataset.columns[0]?.name || '');
  const [method, setMethod] = useState<'iqr' | 'zscore'>('iqr');
  const [action, setAction] = useState<'cap' | 'remove'>('cap');
  const [threshold, setThreshold] = useState<number>(1.5);
  const [confirmed, setConfirmed] = useState(false);

  // Compute statistical bounds and outlier list
  const outlierStats = useMemo(() => {
    if (!selectedColumn) return { min: 0, max: 0, lowerBound: 0, upperBound: 0, outlierCount: 0, outliers: [] };
    const rows = dataset.previewRows || [];
    const values: { val: number; rowIdx: number }[] = [];

    rows.forEach((r, idx) => {
      const v = Number(r[selectedColumn]);
      if (!isNaN(v) && isFinite(v)) {
        values.push({ val: v, rowIdx: idx });
      }
    });

    if (values.length < 4) {
      return { min: 0, max: 0, lowerBound: 0, upperBound: 0, outlierCount: 0, outliers: [] };
    }

    const numsOnly = values.map(v => v.val).sort((a, b) => a - b);
    const min = numsOnly[0];
    const max = numsOnly[numsOnly.length - 1];

    let lowerBound = -Infinity;
    let upperBound = Infinity;

    if (method === 'iqr') {
      const q25 = numsOnly[Math.floor(numsOnly.length * 0.25)];
      const q75 = numsOnly[Math.floor(numsOnly.length * 0.75)];
      const iqr = q75 - q25;
      lowerBound = Math.round((q25 - threshold * iqr) * 100) / 100;
      upperBound = Math.round((q75 + threshold * iqr) * 100) / 100;
    } else {
      const sum = numsOnly.reduce((a, b) => a + b, 0);
      const mean = sum / numsOnly.length;
      const variance = numsOnly.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numsOnly.length;
      const stdDev = Math.sqrt(variance);
      lowerBound = Math.round((mean - threshold * stdDev) * 100) / 100;
      upperBound = Math.round((mean + threshold * stdDev) * 100) / 100;
    }

    const outliers = values.filter(v => v.val < lowerBound || v.val > upperBound);

    return {
      min,
      max,
      lowerBound,
      upperBound,
      outlierCount: outliers.length,
      outliers: outliers.slice(0, 10)
    };
  }, [dataset.previewRows, selectedColumn, method, threshold]);

  const handleAddStep = () => {
    if (!selectedColumn || !confirmed) return;

    const desc = `${action === 'cap' ? 'Cap/Winsorize' : 'Remove'} outliers in "${selectedColumn}" (${method.toUpperCase()}, threshold: ${threshold}, bounds: [${outlierStats.lowerBound}, ${outlierStats.upperBound}])`;

    const step: TransformStep = {
      id: `step_${Date.now()}_outliers`,
      type: 'HANDLE_OUTLIERS',
      column: selectedColumn,
      description: desc,
      params: {
        column: selectedColumn,
        method,
        action,
        threshold
      },
      enabled: true,
      createdAt: new Date().toISOString()
    };

    onAddStep(step);
    setConfirmed(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-5">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <span>Statistical Outlier Detection & Winsorization</span>
        </h4>

        {/* Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Target Column</label>
            <select
              value={selectedColumn}
              onChange={e => setSelectedColumn(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono focus:outline-hidden"
            >
              {numCols.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.dataType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Detection Method</label>
            <select
              value={method}
              onChange={e => {
                const m = e.target.value as any;
                setMethod(m);
                setThreshold(m === 'iqr' ? 1.5 : 3.0);
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-hidden"
            >
              <option value="iqr">IQR (Interquartile Range - 1.5x / 3x)</option>
              <option value="zscore">Z-Score (Standard Deviations)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Remediation Action</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-hidden"
            >
              <option value="cap">Cap / Winsorize (Clamp to lower/upper bounds)</option>
              <option value="remove">Remove Rows containing Outliers</option>
            </select>
          </div>
        </div>

        {/* Statistical Metrics Display */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-lg bg-slate-950/60 border border-slate-800 font-mono text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Min</span>
            <span className="text-white font-bold">{outlierStats.min}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Lower Bound</span>
            <span className="text-amber-400 font-bold">{outlierStats.lowerBound}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Upper Bound</span>
            <span className="text-amber-400 font-bold">{outlierStats.upperBound}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Max</span>
            <span className="text-white font-bold">{outlierStats.max}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Outlier Count</span>
            <span className={outlierStats.outlierCount > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
              {outlierStats.outlierCount} outliers
            </span>
          </div>
        </div>

        {/* User Confirmation Requirement */}
        <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-900/40 space-y-2">
          <label className="flex items-center space-x-2 text-xs text-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="rounded text-amber-500 focus:ring-amber-400"
            />
            <span className="font-semibold">
              I confirm that I have reviewed the statistical thresholds and want to apply this outlier transformation.
            </span>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAddStep}
            disabled={!confirmed}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Outlier Step to Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
