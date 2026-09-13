import React, { useState, useMemo } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, ArrowRight, Plus } from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';
import { DataCleaningEngine } from '../../../utils/dataCleaningEngine';

interface DataTypesTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const DataTypesTab: React.FC<DataTypesTabProps> = ({ dataset, onAddStep }) => {
  const [selectedColumn, setSelectedColumn] = useState<string>(dataset.columns[0]?.name || '');
  const [targetType, setTargetType] = useState<'integer' | 'numeric' | 'date' | 'boolean' | 'text'>('integer');
  const [onInvalid, setOnInvalid] = useState<'null' | 'keep'>('null');

  const currentColumnMeta = useMemo(() => {
    return dataset.columns.find(c => c.name === selectedColumn);
  }, [dataset.columns, selectedColumn]);

  // Analyze preview rows to detect invalid values that cannot convert
  const conversionAnalysis = useMemo(() => {
    if (!selectedColumn) return { invalidList: [], validCount: 0, totalCount: 0 };
    const rows = dataset.previewRows || [];
    const invalidList: { rowIndex: number; column: string; rawValue: unknown; reason: string }[] = [];

    // Run test conversion with dummy collector
    DataCleaningEngine.convertType(
      rows,
      {
        column: selectedColumn,
        targetType,
        onInvalid
      },
      invalidList
    );

    return {
      invalidList,
      validCount: rows.length - invalidList.length,
      totalCount: rows.length
    };
  }, [dataset.previewRows, selectedColumn, targetType, onInvalid]);

  const handleAddStep = () => {
    if (!selectedColumn) return;

    const desc = `Convert "${selectedColumn}" from ${currentColumnMeta?.dataType || 'unknown'} to ${targetType} (${onInvalid === 'null' ? 'invalid -> NULL' : 'preserve invalid'})`;

    const step: TransformStep = {
      id: `step_${Date.now()}_convert_type`,
      type: 'CONVERT_TYPE',
      column: selectedColumn,
      description: desc,
      params: {
        column: selectedColumn,
        targetType,
        onInvalid
      },
      enabled: true,
      createdAt: new Date().toISOString()
    };

    onAddStep(step);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Column Types Table Overview */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Current Column Schema & Inferred Types
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {dataset.columns.map(col => {
            const isSelected = col.name === selectedColumn;
            return (
              <button
                key={col.name}
                onClick={() => setSelectedColumn(col.name)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500/50 ring-1 ring-indigo-500/40 text-white'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="font-mono text-xs font-semibold truncate">{col.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Type: {col.dataType}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Type Conversion Configuration */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-indigo-400" />
          <span>Configure Data Type Conversion</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Selected Column</label>
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
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Target Data Type</label>
            <select
              value={targetType}
              onChange={e => setTargetType(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-hidden"
            >
              <option value="integer">Integer (whole number)</option>
              <option value="numeric">Decimal / Numeric (floating-point)</option>
              <option value="date">Date (YYYY-MM-DD)</option>
              <option value="boolean">Boolean (true / false)</option>
              <option value="text">Text / String</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">On Conversion Failure</label>
            <select
              value={onInvalid}
              onChange={e => setOnInvalid(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-hidden"
            >
              <option value="null">Set invalid values to NULL</option>
              <option value="keep">Keep original value (preserve)</option>
            </select>
          </div>
        </div>

        {/* Validation Feedback & Warnings */}
        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Tested against sample preview:
            </span>
            <span className="font-mono">
              <strong className="text-emerald-400">{conversionAnalysis.validCount} valid</strong>
              {conversionAnalysis.invalidList.length > 0 && (
                <span className="text-rose-400 font-bold ml-2">
                  • {conversionAnalysis.invalidList.length} invalid values
                </span>
              )}
            </span>
          </div>

          {conversionAnalysis.invalidList.length > 0 && (
            <div className="p-2.5 rounded bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Invalid values detected during test conversion:</span>
              </div>
              <div className="font-mono text-[11px] text-rose-200 max-h-24 overflow-y-auto">
                {conversionAnalysis.invalidList.slice(0, 5).map((inv, idx) => (
                  <div key={idx}>
                    Row #{inv.rowIndex + 1}: &quot;{String(inv.rawValue)}&quot; ({inv.reason})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAddStep}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Type Conversion Step to Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
