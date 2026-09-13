import React from 'react';
import {
  BarChart2,
  BarChartHorizontal,
  LineChart,
  PieChart,
  ScatterChart as ScatterIcon,
  Table as TableIcon,
  Activity,
  Layers,
  Settings2,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import {
  ChartConfig,
  ChartType,
  DetectedColumn,
  ChartValidationResult,
  ChartLimit,
  SortOrder,
  ChartAggregation
} from '../../types/visualization';

interface ChartConfigPanelProps {
  config: ChartConfig;
  onChangeConfig: (newConfig: ChartConfig) => void;
  columns: DetectedColumn[];
  validation: ChartValidationResult;
  onAskAiForChart?: () => void;
  isAiLoading?: boolean;
}

const CHART_TYPES: { type: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'bar', label: 'Vertical Bar', icon: BarChart2 },
  { type: 'horizontal_bar', label: 'Horizontal Bar', icon: BarChartHorizontal },
  { type: 'line', label: 'Line Chart', icon: LineChart },
  { type: 'area', label: 'Area Chart', icon: Layers },
  { type: 'pie', label: 'Pie Chart', icon: PieChart },
  { type: 'donut', label: 'Donut Chart', icon: PieChart },
  { type: 'scatter', label: 'Scatter Plot', icon: ScatterIcon },
  { type: 'histogram', label: 'Histogram', icon: BarChart2 },
  { type: 'kpi', label: 'KPI Card', icon: Activity },
  { type: 'table', label: 'Data Table', icon: TableIcon }
];

export const ChartConfigPanel: React.FC<ChartConfigPanelProps> = ({
  config,
  onChangeConfig,
  columns,
  validation,
  onAskAiForChart,
  isAiLoading = false
}) => {
  const numericColumns = columns.filter(c => c.isNumeric);
  const categoricalColumns = columns.filter(c => !c.isNumeric || c.isDateOrTime);

  const isCount = config.aggregation === 'count';
  const isSumOrAvg = config.aggregation === 'sum' || config.aggregation === 'avg';
  const isMinOrMax = config.aggregation === 'min' || config.aggregation === 'max';

  // Filter selectable measure columns based on active aggregation
  const selectableMeasureColumns = React.useMemo(() => {
    if (config.chartType === 'scatter') {
      return columns.filter(c => c.isNumeric);
    }
    if (isCount) {
      // COUNT is valid for ALL column types: text, date, numeric, boolean
      return columns;
    }
    if (isSumOrAvg) {
      // SUM and AVG strictly require numeric columns
      return columns.filter(c => c.isNumeric);
    }
    if (isMinOrMax) {
      // MIN and MAX support numeric and date columns
      return columns.filter(c => c.isNumeric || c.isDateOrTime);
    }
    return columns;
  }, [columns, config.chartType, isCount, isSumOrAvg, isMinOrMax]);

  const handleAggregationChange = (newAgg: ChartAggregation) => {
    let nextY = config.yAxis;
    if (newAgg === 'sum' || newAgg === 'avg') {
      const currentCol = columns.find(c => c.name === config.yAxis);
      if (config.yAxis === 'All Rows' || !currentCol || !currentCol.isNumeric) {
        nextY = numericColumns[0]?.name || '';
      }
    } else if (newAgg === 'min' || newAgg === 'max') {
      const currentCol = columns.find(c => c.name === config.yAxis);
      if (config.yAxis === 'All Rows' || !currentCol || (!currentCol.isNumeric && !currentCol.isDateOrTime)) {
        nextY = columns.find(c => c.isNumeric || c.isDateOrTime)?.name || '';
      }
    }
    onChangeConfig({ ...config, aggregation: newAgg, yAxis: nextY });
  };

  const handleTypeSelect = (type: ChartType) => {
    const updated = { ...config, chartType: type };
    // If switching to KPI, set yAxis to first numeric if not set
    if (type === 'kpi' && (!config.yAxis || !numericColumns.some(c => c.name === config.yAxis))) {
      updated.yAxis = isCount ? (config.yAxis || 'All Rows') : (numericColumns[0]?.name || '');
    }
    // If switching to Histogram, set xAxis/yAxis to numeric
    if (type === 'histogram' && (!config.xAxis || !numericColumns.some(c => c.name === config.xAxis))) {
      updated.xAxis = numericColumns[0]?.name || '';
      updated.yAxis = numericColumns[0]?.name || '';
    }
    onChangeConfig(updated);
  };

  const handleSecondaryMeasureToggle = (colName: string) => {
    const current = config.secondaryMeasures || [];
    const exists = current.includes(colName);
    const updated = exists ? current.filter(c => c !== colName) : [...current, colName];
    onChangeConfig({ ...config, secondaryMeasures: updated });
  };

  const isMultiSeriesSupported =
    config.chartType === 'bar' ||
    config.chartType === 'horizontal_bar' ||
    config.chartType === 'line' ||
    config.chartType === 'area';

  return (
    <div id="chart-config-panel" className="w-80 flex flex-col h-full bg-slate-900 border-r border-slate-800 text-xs overflow-y-auto">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-2 font-semibold text-slate-200">
          <Settings2 className="w-4 h-4 text-indigo-400" />
          <span>Chart Configuration</span>
        </div>

        {onAskAiForChart && (
          <button
            id="btn-ask-ai-chart"
            onClick={onAskAiForChart}
            disabled={isAiLoading}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition-colors"
            title="Ask AI to recommend optimal chart and mapping"
          >
            <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
            <span>{isAiLoading ? 'Analyzing...' : 'Ask AI'}</span>
          </button>
        )}
      </div>

      {/* Validation Banner if any */}
      {!validation.isValid && validation.errors.length > 0 && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
          {validation.errors.map((err, idx) => (
            <div key={idx} className="flex items-start space-x-1.5">
              <span className="text-rose-400">•</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
          {validation.warnings.map((warn, idx) => (
            <div key={idx} className="flex items-start space-x-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 space-y-5">
        {/* 1. Chart Type Grid */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Visualization Type
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {CHART_TYPES.map(ct => {
              const Icon = ct.icon;
              const isSelected = config.chartType === ct.type;
              return (
                <button
                  key={ct.type}
                  id={`chart-type-${ct.type}`}
                  onClick={() => handleTypeSelect(ct.type)}
                  className={`flex items-center space-x-2 px-2.5 py-2 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-sm'
                      : 'bg-slate-850/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className="truncate">{ct.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {config.chartType !== 'table' && (
          <>
            {/* 2. Dimensions & Measures Axis Mapping */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Field Mappings
                </label>
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* X Axis (Dimension/Category) */}
              {config.chartType !== 'kpi' && (
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">
                    {config.chartType === 'scatter'
                      ? 'X Axis (Numeric)'
                      : config.chartType === 'histogram'
                      ? 'Numeric Column (Distribution)'
                      : 'X Axis (Category / Date)'}
                  </label>
                  <select
                    id="select-chart-x-axis"
                    value={config.xAxis}
                    onChange={e => onChangeConfig({ ...config, xAxis: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— Select Column —</option>
                    {columns.map(col => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.semanticType})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Y Axis (Primary Measure / Count Target) */}
              {config.chartType !== 'histogram' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-400 text-[11px]">
                      {config.chartType === 'scatter'
                        ? 'Y Axis (Numeric)'
                        : config.chartType === 'kpi'
                        ? (isCount ? 'KPI Metric (Count Target / All Rows)' : 'KPI Metric (Numeric)')
                        : isCount
                        ? 'Y Axis (Measure / Count Target)'
                        : 'Y Axis (Measure)'}
                    </label>
                    {isCount && (
                      <span className="text-[10px] text-emerald-400 font-medium">
                        Any column / All Rows
                      </span>
                    )}
                  </div>
                  <select
                    id="select-chart-y-axis"
                    value={config.yAxis}
                    onChange={e => onChangeConfig({ ...config, yAxis: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">{isCount ? '— Select Column to Count —' : '— Select Measure —'}</option>
                    {isCount && (
                      <option value="All Rows">All Rows (*)</option>
                    )}
                    {selectableMeasureColumns.map(col => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.semanticType})
                      </option>
                    ))}
                  </select>
                  {isCount ? (
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      COUNT supports any column type (text, date, numeric, boolean) or All Rows (*).
                    </p>
                  ) : isSumOrAvg ? (
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      {config.aggregation.toUpperCase()} requires a numeric column.
                    </p>
                  ) : isMinOrMax ? (
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      {config.aggregation.toUpperCase()} requires a numeric or date column.
                    </p>
                  ) : null}
                </div>
              )}

              {/* Aggregation Method */}
              {config.chartType !== 'scatter' && config.chartType !== 'histogram' && (
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">Aggregation</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['count', 'sum', 'avg', 'min', 'max', 'none'] as ChartAggregation[]).map(agg => (
                      <button
                        key={agg}
                        type="button"
                        id={`btn-agg-${agg}`}
                        onClick={() => handleAggregationChange(agg)}
                        className={`py-1 rounded text-center text-[11px] font-mono border transition-all ${
                          config.aggregation === agg
                            ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {agg.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Secondary Measures (Multi-Series) */}
              {isMultiSeriesSupported && numericColumns.length > 1 && (
                <div>
                  <label className="block text-slate-400 mb-1.5 text-[11px]">
                    Additional Series Measures
                  </label>
                  <div className="space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 max-h-32 overflow-y-auto">
                    {numericColumns
                      .filter(c => c.name !== config.yAxis)
                      .map(col => {
                        const isChecked = (config.secondaryMeasures || []).includes(col.name);
                        return (
                          <label
                            key={col.name}
                            className="flex items-center space-x-2 text-slate-300 hover:text-white cursor-pointer py-0.5"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSecondaryMeasureToggle(col.name)}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                            />
                            <span className="truncate">{col.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Scatter Plot Optional Series Group */}
              {config.chartType === 'scatter' && (
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">
                    Group / Color by (Optional)
                  </label>
                  <select
                    value={config.seriesGroup || ''}
                    onChange={e => onChangeConfig({ ...config, seriesGroup: e.target.value || undefined })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">(None - Single Color)</option>
                    {categoricalColumns.map(col => (
                      <option key={col.name} value={col.name}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Histogram Bins */}
              {config.chartType === 'histogram' && (
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">Number of Bins</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[10, 20, 30, 50].map(b => (
                      <button
                        key={b}
                        onClick={() => onChangeConfig({ ...config, binCount: b })}
                        className={`py-1 rounded text-center font-mono border transition-all ${
                          config.binCount === b
                            ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Sorting & Limiting */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Sorting & Row Limits
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">Sort Order</label>
                  <select
                    value={config.sortOrder}
                    onChange={e => onChangeConfig({ ...config, sortOrder: e.target.value as SortOrder })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-slate-200 focus:outline-none"
                  >
                    <option value="none">Default (None)</option>
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">Limit Rows</label>
                  <select
                    value={config.limit}
                    onChange={e =>
                      onChangeConfig({
                        ...config,
                        limit: e.target.value === 'all' ? 'all' : (parseInt(e.target.value, 10) as ChartLimit)
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Returned</option>
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                    <option value="20">Top 20</option>
                    <option value="50">Top 50</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Display & Formatting Options */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Labels & Display
              </label>

              <div>
                <label className="block text-slate-400 mb-1 text-[11px]">Chart Title</label>
                <input
                  type="text"
                  value={config.title}
                  onChange={e => onChangeConfig({ ...config, title: e.target.value })}
                  placeholder="e.g., Revenue by Month"
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 text-[11px]">Subtitle / Context</label>
                <input
                  type="text"
                  value={config.subtitle || ''}
                  onChange={e => onChangeConfig({ ...config, subtitle: e.target.value })}
                  placeholder="e.g., Q1 - Q4 Analysis"
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showLegend}
                    onChange={e => onChangeConfig({ ...config, showLegend: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <span>Show Legend</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showDataLabels}
                    onChange={e => onChangeConfig({ ...config, showDataLabels: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <span>Show Data Labels</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showGrid}
                    onChange={e => onChangeConfig({ ...config, showGrid: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <span>Show Grid Lines</span>
                </label>

                {/* Safe NULL Handling Toggle */}
                <label className="flex items-center space-x-2 text-slate-400 hover:text-slate-300 cursor-pointer pt-1 border-t border-slate-800/40">
                  <input
                    type="checkbox"
                    checked={config.treatNullAsZero}
                    onChange={e => onChangeConfig({ ...config, treatNullAsZero: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <span>Treat NULL values as 0</span>
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
