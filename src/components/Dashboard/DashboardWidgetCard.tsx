import React, { useState } from 'react';
import {
  MoreVertical,
  RefreshCw,
  Trash2,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileCode,
  Wrench,
  TrendingUp,
  BarChart3,
  PieChart,
  Table as TableIcon,
  Activity,
  Layers,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { DashboardWidget } from '../../types/dashboard';
import { QueryResult } from '../../types/database';
import { ColumnTypeDetector } from '../../services/columnTypeDetector';
import { VisualizationDataProcessor } from '../../services/visualizationDataProcessor';

// Reusable Chart views
import { KpiCardView } from '../Visualization/charts/KpiCardView';
import { BarChartView } from '../Visualization/charts/BarChartView';
import { LineChartView } from '../Visualization/charts/LineChartView';
import { AreaChartView } from '../Visualization/charts/AreaChartView';
import { PieDonutView } from '../Visualization/charts/PieDonutView';
import { ScatterPlotView } from '../Visualization/charts/ScatterPlotView';
import { HistogramView } from '../Visualization/charts/HistogramView';
import { TableView } from '../Visualization/charts/TableView';

interface DashboardWidgetCardProps {
  widget: DashboardWidget;
  result?: QueryResult;
  isLoading?: boolean;
  onRefreshWidget?: (widgetId: string) => void;
  onRemoveWidget?: (widgetId: string) => void;
  onResizeWidget?: (widgetId: string, colSpan: 3 | 4 | 6 | 8 | 12) => void;
  onMoveWidget?: (widgetId: string, direction: 'prev' | 'next') => void;
  onEditQuery?: (sql: string) => void;
  onRepairWidget?: (widget: DashboardWidget) => void;
  onCrossFilter?: (column: string, value: string) => void;
  isPresentationMode?: boolean;
}

export const DashboardWidgetCard: React.FC<DashboardWidgetCardProps> = ({
  widget,
  result,
  isLoading,
  onRefreshWidget,
  onRemoveWidget,
  onResizeWidget,
  onMoveWidget,
  onEditQuery,
  onRepairWidget,
  onCrossFilter,
  isPresentationMode = false
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const activeResult = result || widget.cachedResult;

  // Process data for charts
  const detectedColumns = React.useMemo(() => {
    if (!activeResult || !activeResult.columns) return [];
    return ColumnTypeDetector.detect(activeResult.columns, activeResult.rows);
  }, [activeResult]);

  const processedData = React.useMemo(() => {
    if (!activeResult || !activeResult.rows) return [];
    try {
      return VisualizationDataProcessor.process(
        activeResult.rows,
        widget.chartConfig,
        detectedColumns
      );
    } catch {
      return [];
    }
  }, [activeResult, widget.chartConfig, detectedColumns]);

  const kpiSummary = React.useMemo(() => {
    if (!activeResult || !activeResult.rows || widget.chartType !== 'kpi') return null;
    return VisualizationDataProcessor.computeKpiSummary(
      activeResult.rows,
      widget.chartConfig,
      detectedColumns
    );
  }, [activeResult, widget.chartConfig, detectedColumns, widget.chartType]);

  const colSpanClasses: Record<number, string> = {
    3: 'col-span-12 md:col-span-6 lg:col-span-3',
    4: 'col-span-12 md:col-span-6 lg:col-span-4',
    6: 'col-span-12 lg:col-span-6',
    8: 'col-span-12 lg:col-span-8',
    12: 'col-span-12'
  };

  const cardClass = colSpanClasses[widget.size.colSpan] || 'col-span-12 lg:col-span-6';

  return (
    <div
      className={`${cardClass} bg-slate-900 border border-slate-800/90 rounded-xl overflow-hidden flex flex-col shadow-lg transition-all relative group print:break-inside-avoid print:shadow-none print:border-slate-300 print:bg-white`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsMenuOpen(false);
      }}
      style={{ minHeight: `${widget.size.height || 300}px` }}
    >
      {/* Widget Header */}
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 select-none print:bg-white print:border-slate-200">
        <div className="flex items-center space-x-2 min-w-0 pr-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500/80 flex-shrink-0 print:bg-emerald-600" />
          <div className="truncate">
            <h4 className="text-xs font-semibold text-slate-100 truncate tracking-wide print:text-slate-900">
              {widget.title}
            </h4>
            {widget.description && (
              <p className="text-[11px] text-slate-400 truncate print:text-slate-600">{widget.description}</p>
            )}
          </div>
        </div>

        {/* Header Right Actions */}
        {!isPresentationMode && (
          <div className="flex items-center space-x-1 flex-shrink-0 print:hidden">
            {/* Move Controls */}
            {onMoveWidget && isHovered && (
              <div className="hidden sm:flex items-center space-x-0.5 bg-slate-800/70 rounded p-0.5 border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => onMoveWidget(widget.id, 'prev')}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
                  title="Move widget left / up"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveWidget(widget.id, 'next')}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
                  title="Move widget right / down"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Refresh Button */}
            {onRefreshWidget && (
              <button
                type="button"
                onClick={() => onRefreshWidget(widget.id)}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                title="Refresh this widget"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            )}

            {/* Menu Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen(prev => !prev)}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                title="Widget options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-30 text-xs">
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-800">
                    Resize Widget
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-1.5 border-b border-slate-800">
                    {([3, 4, 6, 12] as const).map(span => (
                      <button
                        key={span}
                        onClick={() => {
                          onResizeWidget?.(widget.id, span);
                          setIsMenuOpen(false);
                        }}
                        className={`py-1 text-[10px] rounded text-center font-medium ${
                          widget.size.colSpan === span
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {span} col
                      </button>
                    ))}
                  </div>

                  {onEditQuery && (
                    <button
                      onClick={() => {
                        onEditQuery(widget.queryRef.sql);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
                    >
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Edit Query in SQL Editor</span>
                    </button>
                  )}

                  {onRemoveWidget && (
                    <button
                      onClick={() => {
                        onRemoveWidget(widget.id);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 flex items-center space-x-2 border-t border-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Remove Widget</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Widget Body */}
      <div className="flex-1 p-4 flex flex-col justify-center relative overflow-hidden">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center space-y-2 backdrop-blur-[2px]">
            <div className="w-6 h-6 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <p className="text-xs font-medium text-slate-300">Refreshing query data...</p>
          </div>
        )}

        {/* State 1: Schema Changed */}
        {widget.status === 'schema_changed' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-amber-300 bg-amber-950/20 rounded-lg border border-amber-900/50">
            <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
            <h5 className="text-xs font-semibold text-amber-200">Data source changed</h5>
            <p className="text-[11px] text-amber-300/80 mt-1 max-w-sm">
              {widget.schemaChangeDetails?.description ||
                'A column or table referenced by this visualization is no longer available in the current database schema.'}
            </p>
            <div className="flex items-center space-x-2 mt-4">
              {onRepairWidget && (
                <button
                  type="button"
                  onClick={() => onRepairWidget(widget)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-medium transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Configure Data</span>
                </button>
              )}
              {onEditQuery && (
                <button
                  type="button"
                  onClick={() => onEditQuery(widget.queryRef.sql)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Edit Query</span>
                </button>
              )}
            </div>
          </div>
        ) : widget.status === 'error' ? (
          /* State 2: Query Execution Error */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-rose-300 bg-rose-950/20 rounded-lg border border-rose-900/50">
            <AlertTriangle className="w-8 h-8 text-rose-400 mb-2" />
            <h5 className="text-xs font-semibold text-rose-200">Unable to load this visualization.</h5>
            <p className="text-[11px] text-rose-300/80 mt-1 max-w-sm">
              {widget.errorMessage || 'The query failed to execute against the active connection.'}
            </p>
            <div className="flex items-center space-x-2 mt-4">
              {onRefreshWidget && (
                <button
                  type="button"
                  onClick={() => onRefreshWidget(widget.id)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-medium transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
              {onEditQuery && (
                <button
                  type="button"
                  onClick={() => onEditQuery(widget.queryRef.sql)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Edit Query</span>
                </button>
              )}
            </div>
          </div>
        ) : !activeResult || activeResult.rows.length === 0 ? (
          /* State 3: No rows */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <HelpCircle className="w-7 h-7 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-300">No data returned</p>
            <p className="text-[11px] text-slate-400 mt-1">Query returned 0 rows for this widget.</p>
          </div>
        ) : (
          /* State 4: Valid Visualization */
          <div className="flex-1 w-full h-full min-h-[200px] relative">
            {widget.chartType === 'kpi' && (
              <KpiCardView rows={activeResult.rows} config={widget.chartConfig} />
            )}

            {widget.chartType === 'bar' && (
              <BarChartView
                data={processedData}
                config={widget.chartConfig}
                isHorizontal={false}
              />
            )}

            {widget.chartType === 'horizontal_bar' && (
              <BarChartView
                data={processedData}
                config={widget.chartConfig}
                isHorizontal={true}
              />
            )}

            {widget.chartType === 'line' && (
              <LineChartView data={processedData} config={widget.chartConfig} />
            )}

            {widget.chartType === 'area' && (
              <AreaChartView data={processedData} config={widget.chartConfig} />
            )}

            {(widget.chartType === 'pie' || widget.chartType === 'donut') && (
              <PieDonutView
                data={processedData}
                config={widget.chartConfig}
                isDonut={widget.chartType === 'donut'}
              />
            )}

            {widget.chartType === 'scatter' && (
              <ScatterPlotView data={processedData} config={widget.chartConfig} />
            )}

            {widget.chartType === 'histogram' && (
              <HistogramView
                rows={activeResult.rows}
                config={widget.chartConfig}
              />
            )}

            {widget.chartType === 'table' && (
              <TableView columns={activeResult.columns} rows={activeResult.rows} />
            )}
          </div>
        )}
      </div>

      {/* Widget Footer Status */}
      {activeResult && (
        <div className="px-4 py-2 border-t border-slate-800/50 flex items-center justify-between text-[10px] text-slate-400 bg-slate-950/20">
          <span>{activeResult.rowCount.toLocaleString()} rows</span>
          {activeResult.executionTimeMs !== undefined && (
            <span>{activeResult.executionTimeMs}ms</span>
          )}
        </div>
      )}
    </div>
  );
};
