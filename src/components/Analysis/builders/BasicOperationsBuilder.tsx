import React, { useState } from 'react';
import {
  Table as TableIcon,
  Columns,
  Eye,
  SortAsc,
  SortDesc,
  Hash,
  Filter,
  ArrowDown,
  Sparkles,
  Play
} from 'lucide-react';
import { TableDetailsResult } from '../../../types/database';
import { GeneratedAnalysisQuery } from '../../../types/analysis';
import { DatabaseApiClient } from '../../../services/databaseApi';

interface BasicOperationsBuilderProps {
  table: TableDetailsResult;
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const BasicOperationsBuilder: React.FC<BasicOperationsBuilderProps> = ({
  table,
  onPreviewQuery
}) => {
  const [activeAction, setActiveAction] = useState<
    'preview' | 'select_columns' | 'distinct' | 'count_rows' | 'count_distinct' | 'top_n' | 'bottom_n' | 'sort_asc' | 'sort_desc' | 'limit_rows'
  >('preview');

  // Form parameters
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [targetColumn, setTargetColumn] = useState<string>(table.columns[0]?.name || '');
  const [limitCount, setLimitCount] = useState<number>(20);

  const toggleColumnSelection = (colName: string) => {
    setSelectedColumns(prev =>
      prev.includes(colName) ? prev.filter(c => c !== colName) : [...prev, colName]
    );
  };

  const handleGenerate = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateBasic', table.schema, table.name, activeAction, {
      columns: selectedColumns,
      column: targetColumn,
      limit: limitCount
    });
    onPreviewQuery(query);
  };

  return (
    <div className="space-y-6">
      {/* Action Selector Pills */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Choose a Basic Operation:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { id: 'preview', label: 'Preview Data', icon: Eye },
            { id: 'select_columns', label: 'Select Columns', icon: Columns },
            { id: 'top_n', label: 'Top N Rows', icon: SortDesc },
            { id: 'bottom_n', label: 'Bottom N Rows', icon: SortAsc },
            { id: 'distinct', label: 'Distinct Values', icon: Filter },
            { id: 'count_rows', label: 'Count Rows', icon: Hash },
            { id: 'count_distinct', label: 'Count Distinct', icon: Hash },
            { id: 'sort_asc', label: 'Sort Ascending', icon: SortAsc },
            { id: 'sort_desc', label: 'Sort Descending', icon: SortDesc },
            { id: 'limit_rows', label: 'Limit Rows', icon: ArrowDown }
          ].map(action => {
            const Icon = action.icon;
            const isSelected = activeAction === action.id;
            return (
              <button
                key={action.id}
                onClick={() => setActiveAction(action.id as any)}
                className={`flex items-center space-x-2 p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span className="text-xs truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Configuration Area based on selected action */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        {activeAction === 'select_columns' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Select columns to retrieve:
              </label>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedColumns(table.columns.map(c => c.name))}
                  className="text-[11px] text-indigo-400 hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedColumns([])}
                  className="text-[11px] text-slate-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-800">
              {table.columns.map(col => {
                const isChecked = selectedColumns.includes(col.name);
                return (
                  <label
                    key={col.name}
                    className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs transition-colors ${
                      isChecked ? 'bg-indigo-950/40 text-indigo-200' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleColumnSelection(col.name)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="truncate font-mono">{col.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {(['top_n', 'bottom_n', 'distinct', 'count_distinct', 'sort_asc', 'sort_desc'].includes(activeAction)) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Target Column:
              </label>
              <select
                value={targetColumn}
                onChange={e => setTargetColumn(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {table.columns.map(col => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.dataType})
                  </option>
                ))}
              </select>
            </div>

            {['top_n', 'bottom_n'].includes(activeAction) && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">
                  Number of Records (N):
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={limitCount}
                  onChange={e => setLimitCount(Math.max(1, parseInt(e.target.value) || 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        )}

        {(['preview', 'select_columns', 'limit_rows', 'sort_asc', 'sort_desc', 'distinct'].includes(activeAction)) && (
          <div className="w-48">
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              Result Row Limit:
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={limitCount}
              onChange={e => setLimitCount(Math.max(1, parseInt(e.target.value) || 50))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleGenerate}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-950/40"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Preview Generated SQL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
