import React, { useState, useMemo } from 'react';
import {
  Table2,
  ListRestart,
  Plus,
  CheckCircle2,
  Eye,
  Sliders,
  Sparkles,
  Layers
} from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';
import { DataCleaningEngine } from '../../../utils/dataCleaningEngine';

interface PivotUnpivotTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const PivotUnpivotTab: React.FC<PivotUnpivotTabProps> = ({ dataset, onAddStep }) => {
  const [activeMode, setActiveMode] = useState<'pivot' | 'unpivot'>('pivot');
  const allCols = dataset.columns.map(c => c.name);

  // 1. Pivot State
  const [rowColumns, setRowColumns] = useState<string[]>(
    allCols.length > 0 ? [allCols[0]] : []
  );
  const [pivotColumn, setPivotColumn] = useState<string>(
    allCols.length > 1 ? allCols[1] : allCols[0] || ''
  );
  const [valueColumn, setValueColumn] = useState<string>(
    allCols.length > 2 ? allCols[2] : allCols[0] || ''
  );
  const [aggregation, setAggregation] = useState<'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX'>('SUM');

  // 2. Unpivot State
  const [idColumns, setIdColumns] = useState<string[]>(
    allCols.length > 0 ? [allCols[0]] : []
  );
  const [valueColumns, setValueColumns] = useState<string[]>(
    allCols.slice(1, 4)
  );
  const [attributeColumnName, setAttributeColumnName] = useState('Attribute');
  const [valueColumnName, setValueColumnName] = useState('Value');

  const sampleRows = useMemo(() => dataset.previewRows || [], [dataset]);

  // Preview Pivot on sample rows
  const pivotPreview = useMemo(() => {
    if (activeMode !== 'pivot' || rowColumns.length === 0 || !pivotColumn || !valueColumn) {
      return null;
    }
    return DataCleaningEngine.pivotTable(
      sampleRows,
      {
        rowColumns,
        pivotColumn,
        valueColumn,
        aggregation
      },
      dataset.columns
    );
  }, [activeMode, sampleRows, rowColumns, pivotColumn, valueColumn, aggregation, dataset.columns]);

  // Preview Unpivot on sample rows
  const unpivotPreview = useMemo(() => {
    if (activeMode !== 'unpivot' || idColumns.length === 0 || valueColumns.length === 0) {
      return null;
    }
    return DataCleaningEngine.unpivotTable(
      sampleRows,
      {
        idColumns,
        valueColumns,
        attributeColumnName,
        valueColumnName
      },
      dataset.columns
    );
  }, [activeMode, sampleRows, idColumns, valueColumns, attributeColumnName, valueColumnName, dataset.columns]);

  const handleAddPivotStep = () => {
    if (rowColumns.length === 0 || !pivotColumn || !valueColumn) return;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'PIVOT_TABLE',
      description: `Pivot table by "${pivotColumn}" with ${aggregation}("${valueColumn}") grouped by [${rowColumns.join(', ')}]`,
      params: {
        rowColumns,
        pivotColumn,
        valueColumn,
        aggregation
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  const handleAddUnpivotStep = () => {
    if (idColumns.length === 0 || valueColumns.length === 0) return;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'UNPIVOT_TABLE',
      description: `Unpivot [${valueColumns.join(', ')}] into "${attributeColumnName}" / "${valueColumnName}" keeping [${idColumns.join(', ')}]`,
      params: {
        idColumns,
        valueColumns,
        attributeColumnName,
        valueColumnName
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6" id="pivot-unpivot-tab">
      {/* Sub-header navigation */}
      <div className="flex gap-2 p-1.5 bg-slate-900/80 rounded-xl border border-slate-800">
        <button
          id="btn-subtab-pivot"
          onClick={() => setActiveMode('pivot')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeMode === 'pivot'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Table2 className="w-4 h-4" />
          Pivot Table (Row to Column Reshape)
        </button>
        <button
          id="btn-subtab-unpivot"
          onClick={() => setActiveMode('unpivot')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeMode === 'unpivot'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ListRestart className="w-4 h-4" />
          Unpivot / Melt (Column to Row Reshape)
        </button>
      </div>

      {/* 1. Pivot Table Mode */}
      {activeMode === 'pivot' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
          <div className="flex items-center gap-2">
            <Table2 className="w-5 h-5 text-purple-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Pivot Table Reshape</h4>
              <p className="text-xs text-slate-400">
                Transform row category values into columns with aggregated numeric summary metrics.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Row Dimensions Multi-select */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Row Identifiers (Group By Dimensions)
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                {dataset.columns.map(c => {
                  const isSelected = rowColumns.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          if (rowColumns.length > 1) setRowColumns(rowColumns.filter(x => x !== c.name));
                        } else {
                          setRowColumns([...rowColumns, c.name]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                        isSelected
                          ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pivot Column, Value Column, Aggregation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Pivot Column (Becomes New Columns)</label>
                <select
                  value={pivotColumn}
                  onChange={e => setPivotColumn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                >
                  {dataset.columns
                    .filter(c => !rowColumns.includes(c.name))
                    .map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Value Column to Aggregate</label>
                <select
                  value={valueColumn}
                  onChange={e => setValueColumn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                >
                  {dataset.columns
                    .filter(c => c.name !== pivotColumn)
                    .map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.dataType})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Aggregation Function</label>
                <select
                  value={aggregation}
                  onChange={e => setAggregation(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-semibold"
                >
                  <option value="SUM">SUM (Total)</option>
                  <option value="COUNT">COUNT (Frequency)</option>
                  <option value="AVG">AVG (Average / Mean)</option>
                  <option value="MIN">MIN (Minimum)</option>
                  <option value="MAX">MAX (Maximum)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Live Pivoted Matrix Preview */}
          {pivotPreview && pivotPreview.rows.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-purple-400" />
                  Live Reshaped Matrix Preview ({pivotPreview.rows.length} rows × {pivotPreview.columns.length} columns)
                </span>
              </div>
              <div className="overflow-x-auto max-h-44 border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      {pivotPreview.columns.map(c => (
                        <th key={c.name} className="p-2 whitespace-nowrap bg-slate-900/90">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                    {pivotPreview.rows.slice(0, 6).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        {pivotPreview.columns.map(c => (
                          <td key={c.name} className="p-2 whitespace-nowrap text-slate-300">
                            {r[c.name] === null ? <span className="text-slate-600">null</span> : String(r[c.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              id="btn-add-pivot-step"
              onClick={handleAddPivotStep}
              disabled={rowColumns.length === 0 || !pivotColumn || !valueColumn}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Pivot Table Step
            </button>
          </div>
        </div>
      )}

      {/* 2. Unpivot / Melt Mode */}
      {activeMode === 'unpivot' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
          <div className="flex items-center gap-2">
            <ListRestart className="w-5 h-5 text-indigo-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Unpivot / Melt Wide Dataset</h4>
              <p className="text-xs text-slate-400">
                Transform multiple wide metric columns into normalized attribute/value pairs (tidy format).
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Fixed ID columns */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Fixed ID / Identifier Columns (Preserved as rows)
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                {dataset.columns.map(c => {
                  const isSelected = idColumns.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          if (idColumns.length > 1) setIdColumns(idColumns.filter(x => x !== c.name));
                        } else {
                          setIdColumns([...idColumns, c.name]);
                          setValueColumns(valueColumns.filter(x => x !== c.name));
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Value columns to melt */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Value Columns to Unpivot into Rows
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                {dataset.columns
                  .filter(c => !idColumns.includes(c.name))
                  .map(c => {
                    const isSelected = valueColumns.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (valueColumns.length > 1) setValueColumns(valueColumns.filter(x => x !== c.name));
                          } else {
                            setValueColumns([...valueColumns, c.name]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Output Column Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Attribute Column Name (Holds original column names)
                </label>
                <input
                  type="text"
                  value={attributeColumnName}
                  onChange={e => setAttributeColumnName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Value Column Name (Holds actual cell data)
                </label>
                <input
                  type="text"
                  value={valueColumnName}
                  onChange={e => setValueColumnName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Live Unpivoted Preview */}
          {unpivotPreview && unpivotPreview.rows.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  Live Normalized Table Preview (Showing First 6 Rows)
                </span>
              </div>
              <div className="overflow-x-auto max-h-44 border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      {unpivotPreview.columns.map(c => (
                        <th key={c.name} className="p-2 whitespace-nowrap bg-slate-900/90">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950">
                    {unpivotPreview.rows.slice(0, 6).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        {unpivotPreview.columns.map(c => (
                          <td key={c.name} className="p-2 whitespace-nowrap text-slate-300">
                            {r[c.name] === null ? <span className="text-slate-600">null</span> : String(r[c.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              id="btn-add-unpivot-step"
              onClick={handleAddUnpivotStep}
              disabled={idColumns.length === 0 || valueColumns.length === 0 || !attributeColumnName.trim() || !valueColumnName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Unpivot Step
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
