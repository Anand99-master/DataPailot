import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Plus,
  X,
  Check,
  BarChart3,
  TrendingUp,
  PieChart,
  Table as TableIcon,
  Maximize2
} from 'lucide-react';
import { DashboardService } from '../../services/dashboardService';
import { Dashboard, DashboardWidget } from '../../types/dashboard';
import { ChartType, ChartConfig } from '../../types/visualization';
import { QueryResult } from '../../types/database';

interface AddToDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  sourceTable?: string;
  datasetId?: string;
  chartType?: ChartType;
  chartConfig?: ChartConfig;
  cachedResult?: QueryResult;
  defaultTitle?: string;
  onSuccess: (dashboardId: string) => void;
}

export const AddToDashboardModal: React.FC<AddToDashboardModalProps> = ({
  isOpen,
  onClose,
  query,
  sourceTable,
  datasetId,
  chartType = 'bar',
  chartConfig,
  cachedResult,
  defaultTitle,
  onSuccess
}) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>('NEW');
  const [newDashboardName, setNewDashboardName] = useState('My Analytics Dashboard');
  const [widgetTitle, setWidgetTitle] = useState(defaultTitle || 'New Visualization');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [selectedChartType, setSelectedChartType] = useState<ChartType>(chartType);
  const [colSpan, setColSpan] = useState<3 | 4 | 6 | 8 | 12>(6);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const list = DashboardService.getDashboards();
      setDashboards(list);
      if (list.length > 0) {
        setSelectedDashboardId(list[0].id);
      } else {
        setSelectedDashboardId('NEW');
      }
      if (defaultTitle) {
        setWidgetTitle(defaultTitle);
      }
      setSelectedChartType(chartType);
    }
  }, [isOpen, defaultTitle, chartType]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!widgetTitle.trim()) return;
    setIsSaving(true);

    try {
      let targetDashboardId = selectedDashboardId;

      if (selectedDashboardId === 'NEW') {
        const created = DashboardService.createDashboard(
          newDashboardName.trim() || 'New Dashboard'
        );
        targetDashboardId = created.id;
      }

      // Prepare referenced columns and tables
      const referencedCols: string[] = cachedResult?.columns?.map(c => c.name) || [];
      const referencedTables: string[] = sourceTable ? [sourceTable] : [];

      const widgetPayload: Omit<DashboardWidget, 'id' | 'position'> = {
        title: widgetTitle.trim(),
        description: widgetDescription.trim() || undefined,
        chartType: selectedChartType,
        size: {
          colSpan,
          height: selectedChartType === 'kpi' ? 180 : 320
        },
        queryRef: {
          type: 'raw_sql',
          sql: query,
          sourceTable,
          referencedTables,
          referencedColumns: referencedCols,
          datasetId
        },
        chartConfig: chartConfig || {
          chartType: selectedChartType,
          title: widgetTitle.trim(),
          xAxis: referencedCols[0] || 'x',
          yAxis: referencedCols[1] || referencedCols[0] || 'y',
          secondaryMeasures: [],
          aggregation: 'none',
          sortOrder: 'none',
          sortBy: 'x',
          limit: 'all',
          showLegend: true,
          showDataLabels: false,
          showGrid: true,
          binCount: 10,
          treatNullAsZero: true
        },
        cachedResult: cachedResult || undefined,
        status: 'success',
        lastExecutedAt: new Date().toISOString()
      };

      DashboardService.addWidget(targetDashboardId, widgetPayload);
      onSuccess(targetDashboardId);
      onClose();
    } catch (err) {
      console.error('Failed to add widget to dashboard:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Add Widget to Dashboard</h3>
              <p className="text-xs text-slate-400">Attach this query or visualization to a reusable dashboard canvas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Target Dashboard */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Dashboard
            </label>
            <div className="space-y-2">
              <select
                value={selectedDashboardId}
                onChange={e => setSelectedDashboardId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="NEW">+ Create New Dashboard</option>
                {dashboards.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.widgets.length} widgets)
                  </option>
                ))}
              </select>

              {selectedDashboardId === 'NEW' && (
                <input
                  type="text"
                  placeholder="Enter new dashboard title..."
                  value={newDashboardName}
                  onChange={e => setNewDashboardName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              )}
            </div>
          </div>

          {/* Widget Title & Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Widget Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={widgetTitle}
              onChange={e => setWidgetTitle(e.target.value)}
              placeholder="e.g. Monthly Revenue by Territory"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={widgetDescription}
              onChange={e => setWidgetDescription(e.target.value)}
              placeholder="e.g. Tracks confirmed gross bookings aggregated monthly"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Visualization Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Visualization Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'kpi', label: 'KPI Metric', icon: TrendingUp },
                { type: 'bar', label: 'Bar Chart', icon: BarChart3 },
                { type: 'line', label: 'Line Trend', icon: TrendingUp },
                { type: 'pie', label: 'Pie / Donut', icon: PieChart },
                { type: 'area', label: 'Area Chart', icon: BarChart3 },
                { type: 'table', label: 'Data Table', icon: TableIcon }
              ].map(item => {
                const Icon = item.icon;
                const active = selectedChartType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedChartType(item.type as ChartType)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      active
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Width (Columns) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Widget Width (12-Column Grid)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { cols: 3, label: '1/4 Width (3 cols)' },
                { cols: 6, label: '1/2 Width (6 cols)' },
                { cols: 8, label: '2/3 Width (8 cols)' },
                { cols: 12, label: 'Full Width (12 cols)' }
              ].map(w => (
                <button
                  key={w.cols}
                  type="button"
                  onClick={() => setColSpan(w.cols as any)}
                  className={`px-2 py-1.5 rounded-lg border text-xs text-center font-medium transition-colors ${
                    colSpan === w.cols
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Query Preview Note */}
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">Underlying Query:</span>
            <p className="font-mono text-[10px] text-slate-400 truncate mt-1">
              {query.replace(/\s+/g, ' ').slice(0, 140)}...
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-end space-x-2 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!widgetTitle.trim() || isSaving}
            className="flex items-center space-x-1.5 px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50 transition-colors shadow-lg shadow-emerald-950"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Adding...' : 'Add to Dashboard'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
