import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  Sliders,
  Eye,
  CalendarDays
} from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep, DateExtractPart, DateDiffUnit } from '../../../types/cleaning';

interface DateTransformationsTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const DateTransformationsTab: React.FC<DateTransformationsTabProps> = ({ dataset, onAddStep }) => {
  const [activeSection, setActiveSection] = useState<'extract' | 'diff'>('extract');

  const dateCols = dataset.columns.filter(c => c.dataType === 'date' || c.dataType === 'text');
  const defaultCol = dateCols[0]?.name || dataset.columns[0]?.name || '';

  // 1. Date Extract
  const [extractCol, setExtractCol] = useState(defaultCol);
  const [extractPart, setExtractPart] = useState<DateExtractPart>('year');
  const [extractColName, setExtractColName] = useState(`${defaultCol}_year`);

  // 2. Date Diff
  const [startCol, setStartCol] = useState(defaultCol);
  const [endCol, setEndCol] = useState(dateCols[1]?.name || defaultCol);
  const [diffUnit, setDiffUnit] = useState<DateDiffUnit>('days');
  const [diffColName, setDiffColName] = useState('Days_Difference');

  const handleAddExtractStep = () => {
    if (!extractCol || !extractColName.trim()) return;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'DATE_EXTRACT',
      column: extractCol,
      description: `Extract ${extractPart} from "${extractCol}" → "${extractColName.trim()}"`,
      params: {
        column: extractCol,
        targetColumnName: extractColName.trim(),
        part: extractPart
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  const handleAddDiffStep = () => {
    if (!startCol || !endCol || !diffColName.trim()) return;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'DATE_DIFF',
      description: `Calculate date difference (${diffUnit}) between "${startCol}" and "${endCol}" → "${diffColName.trim()}"`,
      params: {
        startDateColumn: startCol,
        endDateColumn: endCol,
        targetColumnName: diffColName.trim(),
        unit: diffUnit
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  const extractOptions: { value: DateExtractPart; label: string }[] = [
    { value: 'year', label: 'Year (e.g. 2024)' },
    { value: 'quarter', label: 'Quarter (1, 2, 3, 4)' },
    { value: 'month_num', label: 'Month Number (1 - 12)' },
    { value: 'month_name', label: 'Month Name (January, February...)' },
    { value: 'week', label: 'Week Number (1 - 53)' },
    { value: 'day', label: 'Day of Month (1 - 31)' },
    { value: 'day_name', label: 'Day of Week Name (Monday, Tuesday...)' },
    { value: 'day_of_week', label: 'Day of Week Number (1=Mon, 7=Sun)' },
    { value: 'start_of_month', label: 'Start of Month (YYYY-MM-01)' },
    { value: 'end_of_month', label: 'End of Month (YYYY-MM-DD)' },
    { value: 'start_of_quarter', label: 'Start of Quarter (YYYY-MM-01)' },
    { value: 'end_of_quarter', label: 'End of Quarter (YYYY-MM-DD)' }
  ];

  return (
    <div className="space-y-6" id="date-transformations-tab">
      {/* Sub-header navigation */}
      <div className="flex gap-2 p-1.5 bg-slate-900/80 rounded-xl border border-slate-800">
        <button
          id="btn-subtab-date-extract"
          onClick={() => setActiveSection('extract')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'extract'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Extract Date Components
        </button>
        <button
          id="btn-subtab-date-diff"
          onClick={() => setActiveSection('diff')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'diff'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          Date Difference Calculator
        </button>
      </div>

      {/* 1. Date Component Extraction */}
      {activeSection === 'extract' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Extract Calendar Components</h4>
              <p className="text-xs text-slate-400">
                Derive years, quarters, month names, ISO week numbers, and period boundaries from date fields.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Source Date Column</label>
              <select
                value={extractCol}
                onChange={e => {
                  setExtractCol(e.target.value);
                  setExtractColName(`${e.target.value}_${extractPart}`);
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {dataset.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dataType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Component to Extract</label>
              <select
                value={extractPart}
                onChange={e => {
                  const part = e.target.value as DateExtractPart;
                  setExtractPart(part);
                  setExtractColName(`${extractCol}_${part}`);
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {extractOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Column Name</label>
              <input
                type="text"
                value={extractColName}
                onChange={e => setExtractColName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="btn-add-date-extract-step"
              onClick={handleAddExtractStep}
              disabled={!extractCol || !extractColName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Date Extract Step
            </button>
          </div>
        </div>
      )}

      {/* 2. Date Difference */}
      {activeSection === 'diff' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Date Difference (Duration)</h4>
              <p className="text-xs text-slate-400">
                Compute the duration (days, months, or years) between two date timestamp columns.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Start Date Column</label>
              <select
                value={startCol}
                onChange={e => setStartCol(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {dataset.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dataType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">End Date Column</label>
              <select
                value={endCol}
                onChange={e => setEndCol(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {dataset.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dataType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Difference Unit</label>
              <select
                value={diffUnit}
                onChange={e => setDiffUnit(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Column Name</label>
              <input
                type="text"
                value={diffColName}
                onChange={e => setDiffColName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="btn-add-date-diff-step"
              onClick={handleAddDiffStep}
              disabled={!startCol || !endCol || !diffColName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Date Diff Step
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
