import React, { useState, useMemo } from 'react';
import { DollarSign, AlertTriangle, ArrowRight, Plus, Check } from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';

interface NumericCleaningTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const NumericCleaningTab: React.FC<NumericCleaningTabProps> = ({ dataset, onAddStep }) => {
  const [selectedColumn, setSelectedColumn] = useState<string>(dataset.columns[0]?.name || '');
  const [removeCommas, setRemoveCommas] = useState(true);
  const [removeCurrency, setRemoveCurrency] = useState(true);
  const [removePercentage, setRemovePercentage] = useState(false);
  const [handleNegative, setHandleNegative] = useState<'keep' | 'abs' | 'zero' | 'null'>('keep');

  // Analyze preview rows for currency, commas, percentages, and negative values
  const numericStats = useMemo(() => {
    if (!selectedColumn) return { commas: 0, currency: 0, percentage: 0, negatives: 0, samples: [] };
    const rows = dataset.previewRows || [];
    let commas = 0;
    let currency = 0;
    let percentage = 0;
    let negatives = 0;
    const samples: { raw: unknown; cleaned: number | null }[] = [];

    rows.forEach(r => {
      const v = r[selectedColumn];
      if (v === null || v === undefined || v === '') return;

      const str = String(v).trim();
      if (str.includes(',')) commas++;
      if (/[\$\€\£\¥\₹]|\b(USD|EUR|GBP)\b/i.test(str)) currency++;
      if (str.includes('%')) percentage++;

      const parsed = parseFloat(str.replace(/[\$\€\£\¥\₹,]/g, '').replace(/\b(USD|EUR)\b/gi, ''));
      if (!isNaN(parsed) && parsed < 0) negatives++;

      if (samples.length < 6) {
        let clnVal: number | null = isNaN(parsed) ? null : parsed;
        if (clnVal !== null && removePercentage && str.includes('%')) clnVal = clnVal / 100;
        if (clnVal !== null && clnVal < 0) {
          if (handleNegative === 'abs') clnVal = Math.abs(clnVal);
          else if (handleNegative === 'zero') clnVal = 0;
          else if (handleNegative === 'null') clnVal = null;
        }
        samples.push({ raw: v, cleaned: clnVal });
      }
    });

    return { commas, currency, percentage, negatives, samples };
  }, [dataset.previewRows, selectedColumn, removePercentage, handleNegative]);

  const handleAddStep = () => {
    if (!selectedColumn) return;

    const descParts: string[] = [];
    if (removeCommas) descParts.push('remove commas');
    if (removeCurrency) descParts.push('strip currency symbols');
    if (removePercentage) descParts.push('parse percentages');
    if (handleNegative !== 'keep') descParts.push(`negative values: ${handleNegative}`);

    const step: TransformStep = {
      id: `step_${Date.now()}_num_clean`,
      type: 'NUMERIC_CLEAN',
      column: selectedColumn,
      description: `Numeric cleaning on "${selectedColumn}": ${descParts.join(', ')}`,
      params: {
        column: selectedColumn,
        removeCommas,
        removeCurrency,
        removePercentage,
        handleNegative
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
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>Numeric & Currency Normalization</span>
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

        {/* Cleaning Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-950/60 border border-slate-800">
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Formatting & Symbols
            </label>
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={removeCommas}
                onChange={e => setRemoveCommas(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Remove Thousands Separator (e.g. &quot;12,500&quot; → 12500)</span>
            </label>
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={removeCurrency}
                onChange={e => setRemoveCurrency(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Strip Currency Symbols ($ € £ ¥ ₹ USD EUR)</span>
            </label>
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={removePercentage}
                onChange={e => setRemovePercentage(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Convert Percentage Strings (&quot;15.5%&quot; → 0.155)</span>
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Negative Value Strategy
            </label>
            <select
              value={handleNegative}
              onChange={e => setHandleNegative(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-hidden"
            >
              <option value="keep">Keep Negative Values (Preserve legitimate negatives)</option>
              <option value="abs">Convert to Absolute Value (Math.abs)</option>
              <option value="zero">Cap negative values at Zero (0)</option>
              <option value="null">Set negative values to NULL</option>
            </select>
            {numericStats.negatives > 0 && (
              <p className="text-[11px] text-amber-300 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Detected {numericStats.negatives} negative values in preview sample.</span>
              </p>
            )}
          </div>
        </div>

        {/* Live Transformation Samples */}
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Transformation Preview
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
            {numericStats.samples.map((s, idx) => (
              <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 truncate">&quot;{String(s.raw)}&quot;</span>
                <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0 mx-1" />
                <span className="text-emerald-400 font-bold">{s.cleaned !== null ? s.cleaned : 'NULL'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAddStep}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Numeric Cleaning Step to Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
