import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart2,
  Table as TableIcon,
  Sparkles,
  Download,
  Bookmark,
  Maximize2,
  Minimize2,
  AlertTriangle,
  RefreshCw,
  Database,
  Layers,
  Copy,
  Check,
  FileSpreadsheet,
  LayoutDashboard
} from 'lucide-react';
import { QueryResult } from '../../types/database';
import {
  ChartConfig,
  ChartType,
  DetectedColumn,
  SavedVisualization,
  VisualizationInsight
} from '../../types/visualization';
import { ColumnTypeDetector } from '../../services/columnTypeDetector';
import { ChartRecommender } from '../../services/chartRecommender';
import { VisualizationDataProcessor } from '../../services/visualizationDataProcessor';
import { VisualizationInsightsService } from '../../services/visualizationInsightsService';
import { VisualizationExportService } from '../../services/visualizationExportService';
import { ChartConfigPanel } from './ChartConfigPanel';
import { InsightsDrawer } from './InsightsDrawer';
import { SavedVisualizationsModal } from './SavedVisualizationsModal';
import { SaveVisualizationDialog } from './SaveVisualizationDialog';

// Chart components
import { KpiCardView } from './charts/KpiCardView';
import { BarChartView } from './charts/BarChartView';
import { LineChartView } from './charts/LineChartView';
import { AreaChartView } from './charts/AreaChartView';
import { PieDonutView } from './charts/PieDonutView';
import { ScatterPlotView } from './charts/ScatterPlotView';
import { HistogramView } from './charts/HistogramView';
import { TableView } from './charts/TableView';

interface VisualizationWorkspaceProps {
  queryResult: QueryResult | null;
  isConnected: boolean;
  onOpenConnectModal?: () => void;
  isAiConfigured?: boolean;
  onAddToDashboard?: (config: ChartConfig, result: QueryResult) => void;
}

const LOCAL_STORAGE_SAVED_CHARTS_KEY = 'datapilot_saved_visualizations';

export const VisualizationWorkspace: React.FC<VisualizationWorkspaceProps> = ({
  queryResult,
  isConnected,
  onOpenConnectModal,
  isAiConfigured = false,
  onAddToDashboard
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // View mode: 'chart' | 'table'
  const [activeViewMode, setActiveViewMode] = useState<'chart' | 'table'>('chart');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Insights drawer & Saved modal states
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insights, setInsights] = useState<VisualizationInsight[]>([]);

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [savedVisualizations, setSavedVisualizations] = useState<SavedVisualization[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SAVED_CHARTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [copiedConfig, setCopiedConfig] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isAiRecommending, setIsAiRecommending] = useState(false);

  // 1. Detect column metadata from query result
  const detectedColumns = useMemo<DetectedColumn[]>(() => {
    if (!queryResult || !queryResult.columns || !queryResult.rows) return [];
    return ColumnTypeDetector.detect(queryResult.columns, queryResult.rows);
  }, [queryResult]);

  // 2. Chart Configuration State
  const [config, setConfig] = useState<ChartConfig>(() => ({
    chartType: 'bar',
    xAxis: '',
    yAxis: '',
    secondaryMeasures: [],
    aggregation: 'none',
    sortOrder: 'none',
    sortBy: 'x',
    limit: 'all',
    title: 'Query Visualization',
    subtitle: '',
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false,
    samplingEnabled: false
  }));

  // 3. Automated initial recommendation whenever a new query result arrives
  useEffect(() => {
    if (detectedColumns.length > 0 && queryResult && queryResult.rows.length > 0) {
      const rec = ChartRecommender.recommend(detectedColumns, queryResult.rowCount);
      const defaultY = rec.yAxis || detectedColumns.find(c => c.isNumeric)?.name || '';
      const defaultX = rec.xAxis || detectedColumns.find(c => !c.isNumeric || c.isDateOrTime)?.name || '';

      setConfig(prev => ({
        ...prev,
        chartType: rec.chartType,
        xAxis: defaultX,
        yAxis: defaultY,
        secondaryMeasures: rec.secondaryMeasures || [],
        seriesGroup: rec.seriesGroup,
        title: rec.title || `Analysis of ${defaultY || 'Data'}`,
        subtitle: `${queryResult.rows.length} records analyzed`
      }));
    }
  }, [detectedColumns, queryResult]);

  // 4. Validate current configuration
  const validation = useMemo(() => {
    return ChartRecommender.validateConfig(config, detectedColumns);
  }, [config, detectedColumns]);

  // 5. Process chart data with safe NULL handling and sorting
  const processedData = useMemo(() => {
    if (!queryResult || !queryResult.rows) return [];
    return VisualizationDataProcessor.process(queryResult.rows, config, detectedColumns);
  }, [queryResult, config, detectedColumns]);

  // Ask AI for Chart Recommendation
  const handleAskAiForChart = async () => {
    if (!queryResult || detectedColumns.length === 0) return;
    setIsAiRecommending(true);
    try {
      const rec = ChartRecommender.recommend(detectedColumns, queryResult.rowCount);
      const defaultY = rec.yAxis || detectedColumns.find(c => c.isNumeric)?.name || '';
      const defaultX = rec.xAxis || detectedColumns.find(c => !c.isNumeric || c.isDateOrTime)?.name || '';

      setConfig(prev => ({
        ...prev,
        chartType: rec.chartType,
        xAxis: defaultX,
        yAxis: defaultY,
        secondaryMeasures: rec.secondaryMeasures || [],
        title: rec.title || prev.title,
        subtitle: rec.reason
      }));
    } finally {
      setIsAiRecommending(false);
    }
  };

  // Generate factual insights
  const handleGenerateInsights = async () => {
    if (!queryResult || !queryResult.rows) return;
    setIsInsightsOpen(true);
    setIsGeneratingInsights(true);
    try {
      const results = await VisualizationInsightsService.generateInsights(
        queryResult.query || '',
        queryResult.rows,
        detectedColumns,
        config,
        Boolean(isAiConfigured)
      );
      setInsights(results);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  // Save visualization
  const handleSaveVisualization = (name: string) => {
    const newSave: SavedVisualization = {
      id: `vis-${Date.now()}`,
      name,
      chartType: config.chartType,
      sourceQueryId: queryResult?.sourceQueryId,
      querySql: queryResult?.query,
      dimensions: config.xAxis ? [config.xAxis] : [],
      measures: [config.yAxis, ...(config.secondaryMeasures || [])].filter(Boolean),
      config: { ...config },
      createdAt: new Date().toISOString()
    };

    const updated = [newSave, ...savedVisualizations];
    setSavedVisualizations(updated);
    localStorage.setItem(LOCAL_STORAGE_SAVED_CHARTS_KEY, JSON.stringify(updated));
  };

  const handleDeleteSavedVisualization = (id: string) => {
    const updated = savedVisualizations.filter(s => s.id !== id);
    setSavedVisualizations(updated);
    localStorage.setItem(LOCAL_STORAGE_SAVED_CHARTS_KEY, JSON.stringify(updated));
  };

  const handleLoadSavedVisualization = (saved: SavedVisualization) => {
    setConfig({ ...saved.config });
  };

  // Export handlers
  const handleDownloadPng = async () => {
    if (!chartContainerRef.current) return;
    try {
      await VisualizationExportService.downloadChartAsPng(
        chartContainerRef.current,
        config.title.toLowerCase().replace(/\s+/g, '_') || 'datapilot_chart'
      );
    } catch (err: any) {
      alert(err.message || 'Failed to export chart as image.');
    }
  };

  const handleExportCsv = () => {
    if (!queryResult) return;
    VisualizationExportService.exportToCsv(
      config.title.toLowerCase().replace(/\s+/g, '_') || 'chart_data',
      queryResult.columns,
      queryResult.rows
    );
  };

  const handleCopyConfig = async () => {
    const success = await VisualizationExportService.copyConfig(config);
    if (success) {
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  };

  // 1. Connection check
  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-950 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <Database className="w-7 h-7 text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-200">No database connected.</h2>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
          Connect your PostgreSQL instance to discover schemas, execute queries, and generate intelligent charts.
        </p>
        {onOpenConnectModal && (
          <button
            onClick={onOpenConnectModal}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 transition-all"
          >
            Connect Database
          </button>
        )}
      </div>
    );
  }

  // 2. Data check
  if (!queryResult || queryResult.rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-950 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <BarChart2 className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-200">No data available for visualization.</h2>
        <p className="text-xs text-slate-400 max-w-md mt-1">
          Execute a query in the <span className="text-indigo-400 font-medium">SQL Editor</span> or run an operation in the <span className="text-emerald-400 font-medium">Analysis Toolkit</span> to visualize live database results.
        </p>
      </div>
    );
  }

  const isTruncated = Boolean(queryResult.isTruncated || queryResult.truncated);

  return (
    <div
      id="visualization-workspace"
      className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-950 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'relative'
      }`}
    >
      {/* Top Controls Toolbar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs z-10 flex-shrink-0">
        {/* Left: View Mode Toggle & Status */}
        <div className="flex items-center space-x-3">
          {/* Table ↔ Chart Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
            <button
              id="btn-vis-mode-chart"
              onClick={() => setActiveViewMode('chart')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeViewMode === 'chart'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Chart</span>
            </button>
            <button
              id="btn-vis-mode-table"
              onClick={() => setActiveViewMode('table')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeViewMode === 'table'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Dataset Info */}
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <span className="font-mono text-slate-200 font-medium">{queryResult.rowCount.toLocaleString()}</span>
            <span>records</span>
            <span>•</span>
            <span className="font-mono text-slate-200">{queryResult.columns.length}</span>
            <span>columns</span>
            <span>•</span>
            <span className="font-mono">{queryResult.executionTimeMs}ms</span>
          </div>
        </div>

        {/* Right: Actions (Insights, Save, Export, Fullscreen) */}
        <div className="flex items-center space-x-2">
          {/* Generate Insights Button */}
          <button
            id="btn-generate-insights"
            onClick={handleGenerateInsights}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition-colors"
            title="Generate factual data insights"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Generate Insights</span>
          </button>

          {/* Save Visualization */}
          <button
            id="btn-save-visualization"
            onClick={() => setIsSaveDialogOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors"
            title="Save current visualization configuration"
          >
            <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
            <span>Save</span>
          </button>

          {/* Add to Dashboard */}
          {onAddToDashboard && (
            <button
              id="btn-add-to-dashboard-vis"
              onClick={() => onAddToDashboard(config, queryResult)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 hover:text-white border border-emerald-700/60 transition-colors"
              title="Add this chart to an executive dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add to Dashboard</span>
            </button>
          )}

          {/* Saved Visualizations Drawer Toggle */}
          {savedVisualizations.length > 0 && (
            <button
              onClick={() => setIsSavedModalOpen(true)}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs flex items-center space-x-1"
            >
              <span>Saved</span>
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {savedVisualizations.length}
              </span>
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              id="btn-export-menu"
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {isExportMenuOpen && (
              <div
                className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-30 text-xs"
                onMouseLeave={() => setIsExportMenuOpen(false)}
              >
                <button
                  onClick={() => {
                    handleDownloadPng();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-850 flex items-center space-x-2 text-slate-200"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Download Chart as PNG</span>
                </button>
                <button
                  onClick={() => {
                    handleExportCsv();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-850 flex items-center space-x-2 text-slate-200"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Data as CSV</span>
                </button>
                <button
                  onClick={() => {
                    handleCopyConfig();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-850 flex items-center space-x-2 text-slate-200"
                >
                  {copiedConfig ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{copiedConfig ? 'Copied Config!' : 'Copy Chart Config'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Truncated Result Protection Banner */}
      {isTruncated && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center space-x-2 text-amber-300 text-xs flex-shrink-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
          <span>
            Visualization uses the available result set. Query result was limited.
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Configuration Panel (Hidden in Table Mode) */}
        {activeViewMode === 'chart' && (
          <ChartConfigPanel
            config={config}
            onChangeConfig={setConfig}
            columns={detectedColumns}
            validation={validation}
            onAskAiForChart={handleAskAiForChart}
            isAiLoading={isAiRecommending}
          />
        )}

        {/* Center: Stage Canvas */}
        <div className="flex-1 flex flex-col h-full overflow-hidden p-4 min-w-0">
          {activeViewMode === 'table' ? (
            <TableView columns={queryResult.columns} rows={queryResult.rows} />
          ) : (
            <div
              ref={chartContainerRef}
              id="chart-display-canvas"
              className="w-full h-full bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col shadow-inner relative overflow-hidden"
            >
              {/* Chart Header */}
              <div className="mb-4 flex-shrink-0">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {config.title || 'Data Visualization'}
                </h3>
                {config.subtitle && (
                  <p className="text-xs text-slate-400 mt-0.5">{config.subtitle}</p>
                )}
              </div>

              {/* Chart Render Area */}
              <div className="flex-1 w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden">
                {!validation.isValid ? (
                  <div className="text-center p-8 max-w-md">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-slate-200 mb-1">
                      Incompatible Configuration
                    </div>
                    <p className="text-xs text-slate-400">
                      {validation.errors[0] || 'Please adjust the selected X or Y columns.'}
                    </p>
                  </div>
                ) : config.chartType === 'kpi' ? (
                  <KpiCardView rows={queryResult.rows} config={config} />
                ) : config.chartType === 'bar' ? (
                  <BarChartView data={processedData} config={config} isHorizontal={false} />
                ) : config.chartType === 'horizontal_bar' ? (
                  <BarChartView data={processedData} config={config} isHorizontal={true} />
                ) : config.chartType === 'line' ? (
                  <LineChartView data={processedData} config={config} />
                ) : config.chartType === 'area' ? (
                  <AreaChartView data={processedData} config={config} />
                ) : config.chartType === 'pie' ? (
                  <PieDonutView data={processedData} config={config} isDonut={false} />
                ) : config.chartType === 'donut' ? (
                  <PieDonutView data={processedData} config={config} isDonut={true} />
                ) : config.chartType === 'scatter' ? (
                  <ScatterPlotView data={processedData} config={config} />
                ) : config.chartType === 'histogram' ? (
                  <HistogramView rows={queryResult.rows} config={config} />
                ) : (
                  <TableView columns={queryResult.columns} rows={queryResult.rows} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Insights Drawer */}
        <InsightsDrawer
          isOpen={isInsightsOpen}
          onClose={() => setIsInsightsOpen(false)}
          insights={insights}
          isLoading={isGeneratingInsights}
          onRegenerate={handleGenerateInsights}
        />
      </div>

      {/* Save Dialog */}
      <SaveVisualizationDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        config={config}
        onSave={handleSaveVisualization}
      />

      {/* Saved List Modal */}
      <SavedVisualizationsModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedList={savedVisualizations}
        onLoadVisualization={handleLoadSavedVisualization}
        onDeleteVisualization={handleDeleteSavedVisualization}
      />
    </div>
  );
};
