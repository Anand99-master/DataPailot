import React, { useState, useMemo } from 'react';
import { Calendar, RefreshCw, AlertTriangle, ArrowRight, Plus } from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';
import { DataCleaningEngine } from '../../../utils/dataCleaningEngine';

interface DateStandardizationTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const DateStandardizationTab: React.FC<DateStandardizationTabProps> = ({ dataset, onAddStep }) => {
  // Find default date column or first column
  const dateCols = useMemo(() => {
    return dataset.columns.filter(c => c.dataType === 'date' || c.dataType === 'timestamp' || c.name.toLowerCase().includes('date') || c.name.toLowerCase().includes('time'));
  }, [dataset.columns]);

  const [selectedColumn, setSelectedColumn] = useState<string>(dateCols[0]?.name || dataset.columns[0]?.name || '');
  const [targetFormat, setTargetFormat] = useState<'YYYY-MM-DD' | 'YYYY/MM/DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO'>('YYYY-MM-DD');

  // Preview date normalization on sample rows
  const datePreview = useMemo(() => {
    if (!selectedColumn) return { samples: [], unparseableCount: 0 };
    const rows = dataset.previewRows || [];
    const samples: { raw: unknown; standardized: string | null; valid: boolean }[] = [];
    let unparseableCount = 0;

    for (const r of rows) {
      const raw = r[selectedColumn];
      if (raw === null || raw === undefined || raw === '') continue;

      const strVal = String(raw).trim();
      const parsed = DataCleaningEngine.parseFlexibleDate(strVal);

      if (parsed && !isNaN(parsed.getTime())) {
        samples.push({
          raw,
          standardized: DataCleaningEngine.formatDate(parsed, targetFormat),
          valid: true
        });
      } else {
        unparseableCount++;
        samples.push({
          raw,
          standardized: null,
          valid: false
        });
      }
    }

    return {
      samples: samples.slice(0, 8),
      unparseableCount
    };
  }, [dataset.previewRows, selectedColumn, targetFormat]);

  const handleAddStep = () => {
    if (!selectedColumn) return;

    const step: TransformStep = {
      id: `step_${Date.now()}_std_date`,
      type: 'STANDARDIZE_DATE',
      column: selectedColumn,
      description: `Standardize date in "${selectedColumn}" to format "${targetFormat}"`,
      params: {
        column: selectedColumn,
        targetFormat
      },
      enabled: true,
      createdAt: new Date().toISOString()
    };

    onAddStep(step);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Date Configuration Form */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Date Format Standardization</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Target Column</label>
            <select
              value={selectedColumn}
              onChange={e => setSelectedColumn(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono focus:outline-hidden"
            >
              {dataset.columns.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.dataType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Target Output Format</label>
            <select
              value={targetFormat}
              onChange={e => setTargetFormat(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono focus:outline-hidden"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-09-15) - ISO Standard</option>
              <option value="YYYY/MM/DD">YYYY/MM/DD (e.g. 2026/09/15)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 15/09/2026) - International</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 09/15/2026) - US Standard</option>
              <option value="ISO">Full ISO Timestamp (e.g. 2026-09-15T00:00:00.000Z)</option>
            </select>
          </div>
        </div>

        {/* Live Transformation Preview */}
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Live Sample Conversions
            </span>
            {datePreview.unparseableCount > 0 ? (
              <span className="text-xs font-mono text-rose-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {datePreview.unparseableCount} unparseable dates flagged
              </span>
            ) : (
              <span className="text-xs font-mono text-emerald-400">All sample dates parseable</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {datePreview.samples.map((s, idx) => (
              <div
                key={idx}
                className={`p-2 rounded border text-xs flex items-center justify-between font-mono ${
                  s.valid
                    ? 'bg-slate-900 border-slate-800 text-slate-300'
                    : 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                }`}
              >
                <span className="truncate max-w-[140px]">&quot;{String(s.raw)}&quot;</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mx-1" />
                <span className={s.valid ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {s.valid ? s.standardized : 'Unparseable'}
                </span>
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
            <span>Add Date Standardization Step</span>
          </button>
        </div>
      </div>
    </div>
  );
};
