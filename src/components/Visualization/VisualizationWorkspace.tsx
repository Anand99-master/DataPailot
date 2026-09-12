import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  LayoutDashboard,
  Code,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { QueryResult, DiscoveredTable, TableDetailsResult } from '../../types/database';
import {
  ChartConfig,
  ChartType,
  DetectedColumn,
  SavedVisualization,
  VisualizationInsight,
  ColumnSemanticType
} from '../../types/visualization';
import { ImportedDataset } from '../../types/import';
import { ColumnTypeDetector } from '../../services/columnTypeDetector';
import { ChartRecommender } from '../../services/chartRecommender';
import { VisualizationDataProcessor } from '../../services/visualizationDataProcessor';
import { VisualizationInsightsService } from '../../services/visualizationInsightsService';
import { VisualizationExportService } from '../../services/visualizationExportService';
import { VisualizationQueryBuilder } from '../../services/visualizationQueryBuilder';
import { DatabaseApiClient } from '../../services/databaseApi';
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

export interface VisualizationWorkspaceProps {
  queryResult: QueryResult | null;
  isConnected: boolean;
  onOpenConnectModal?: () => void;
  isAiConfigured?: boolean;
  onAddToDashboard?: (config: ChartConfig, result: QueryResult, sourceTable?: string, datasetId?: string) => void;

  // Imported Datasets support
  importedDatasets?: ImportedDataset[];
  activeDataset?: ImportedDataset | null;
  onSelectDataset?: (dataset: ImportedDataset) => void;
  onOpenImportModal?: () => void;
  selectedTable?: TableDetailsResult | null;
  tables?: DiscoveredTable[];
  onSelectTable?: (table: DiscoveredTable) => void;
}

const LOCAL_STORAGE_SAVED_CHARTS_KEY = 'datapilot_saved_visualizations';

export const VisualizationWorkspace: React.FC<VisualizationWorkspaceProps> = ({
  queryResult,
  isConnected,
  onOpenConnectModal,
  isAiConfigured = false,
  onAddToDashboard,
  importedDatasets = [],
  activeDataset = null,
  onSelectDataset,
  onOpenImportModal,
  selectedTable = null,
  tables = [],
  onSelectTable
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // View mode: 'chart' | 'table'
  const [activeViewMode, setActiveViewMode] = useState<'chart' | 'table'>('chart');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dataset & Data Source mode selection
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [dataSourceMode, setDataSourceMode] = useState<'imported' | 'database'>('imported');

  // Query Execution State for Imported Datasets & Direct Tables
  const [internalQueryResult, setInternalQueryResult] = useState<QueryResult | null>(null);
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [generatedSql, setGeneratedSql] = useState<string>('');
  const [isSqlPreviewOpen, setIsSqlPreviewOpen] = useState(false);
  const [rawSelectedMeasure, setRawSelectedMeasure] = useState<string>('');

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
  const [copiedSql, setCopiedSql] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isAiRecommending, setIsAiRecommending] = useState(false);

  // 1. Resolve Active Dataset
  const currentDataset = useMemo<ImportedDataset | null>(() => {
    if (selectedDatasetId) {
      const found = importedDatasets.find(d => d.datasetId === selectedDatasetId);
      if (found) return found;
    }
    if (activeDataset) return activeDataset;
    if (selectedTable?.schema === 'imported') {
      const found = importedDatasets.find(d => d.tableName === selectedTable.name);
      if (found) return found;
    }
    return importedDatasets.length > 0 ? importedDatasets[0] : null;
  }, [importedDatasets, activeDataset, selectedDatasetId, selectedTable]);

  // Synchronize dataSourceMode based on available sources
  useEffect(() => {
    if (currentDataset && !isConnected) {
      setDataSourceMode('imported');
    } else if (isConnected && !currentDataset) {
      setDataSourceMode('database');
    } else if (currentDataset && isConnected) {
      // If selected table is imported, prioritize imported
      if (selectedTable?.schema === 'imported') {
        setDataSourceMode('imported');
      }
    }
  }, [currentDataset, isConnected, selectedTable]);

  // Map dataset columns to DetectedColumn[] format
  const datasetColumns = useMemo<DetectedColumn[]>(() => {
    if (!currentDataset) return [];
    return currentDataset.columns.map(c => {
      const isNumeric = c.dataType === 'integer' || c.dataType === 'numeric';
      const isDateOrTime = c.dataType === 'date' || c.dataType === 'timestamp';
      const isBoolean = c.dataType === 'boolean';
      return {
        name: c.name,
        dataType: c.dataType,
        semanticType: (c.dataType as ColumnSemanticType) || (isNumeric ? 'numeric' : 'text'),
        isNumeric,
        isDateOrTime,
        isCategorical: !isNumeric && !isBoolean,
        isBoolean,
        isNullable: c.isNullable ?? true,
        distinctCount: c.sampleValues?.length || 10,
        nullCount: c.nullCount || 0,
        sampleValues: c.sampleValues || []
      };
    });
  }, [currentDataset]);

  // Determine which QueryResult is active
  const effectiveQueryResult = useMemo<QueryResult | null>(() => {
    if (dataSourceMode === 'imported') {
      return internalQueryResult;
    }
    return queryResult || internalQueryResult;
  }, [dataSourceMode, internalQueryResult, queryResult]);

  // Detect column metadata from query result or fallback to dataset schema
  const detectedColumns = useMemo<DetectedColumn[]>(() => {
    if (effectiveQueryResult && effectiveQueryResult.columns && effectiveQueryResult.rows && effectiveQueryResult.rows.length > 0) {
      return ColumnTypeDetector.detect(effectiveQueryResult.columns, effectiveQueryResult.rows);
    }
    if (dataSourceMode === 'imported' && datasetColumns.length > 0) {
      return datasetColumns;
    }
    return [];
  }, [effectiveQueryResult, dataSourceMode, datasetColumns]);

  // 2. Chart Configuration State
  const [config, setConfig] = useState<ChartConfig>(() => ({
    chartType: 'bar',
    xAxis: '',
    yAxis: '',
    secondaryMeasures: [],
    aggregation: 'count',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Data Visualization',
    subtitle: '',
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false,
    samplingEnabled: false
  }));

  // Execution engine: queries SQLite in memory for imported datasets
  const executeAnalyticalQuery = useCallback(async (
    targetDataset: ImportedDataset,
    targetConfig: ChartConfig,
    measureCol?: string
  ) => {
    setIsQueryLoading(true);
    setQueryError(null);
    try {
      const dim = targetConfig.xAxis;
      const meas = measureCol !== undefined ? measureCol : (rawSelectedMeasure || targetConfig.yAxis);
      const agg = targetConfig.aggregation || 'count';

      const sql = VisualizationQueryBuilder.buildQuery({
        tableName: targetDataset.tableName,
        dimension: dim,
        measure: meas,
        aggregation: agg,
        chartType: targetConfig.chartType,
        sortOrder: targetConfig.sortOrder,
        limit: targetConfig.limit,
        dialect: 'sqlite'
      });

      setGeneratedSql(sql);

      const res = await DatabaseApiClient.executeQuery(sql);
      if (res.status === 'error' || res.status === 'cancelled') {
        setQueryError(res.errorMessage || 'Failed to execute query');
      } else {
        setInternalQueryResult(res);

        // Determine returned measure column name
        const resultCols = res.columns.map(c => c.name);
        const autoY = resultCols.find(c => c !== dim) || resultCols[1] || resultCols[0] || '';
        
        setConfig(prev => ({
          ...prev,
          yAxis: autoY,
          title: prev.title || `${targetDataset.name} by ${dim || 'Category'}`
        }));
      }
    } catch (err: any) {
      setQueryError(err.message || 'Execution error');
    } finally {
      setIsQueryLoading(false);
    }
  }, [rawSelectedMeasure]);

  // Initialize defaults on dataset change
  useEffect(() => {
    if (dataSourceMode === 'imported' && currentDataset && currentDataset.columns.length > 0) {
      const cols = currentDataset.columns;

      // Smart dimension candidate: look for Region, Category, Date, or first text column
      const regionCol = cols.find(c => c.name.toLowerCase() === 'region');
      const textCol = cols.find(c => c.dataType === 'text' || c.dataType === 'date');
      const defaultX = regionCol?.name || textCol?.name || cols[0].name;

      // Smart measure candidate: look for Order_ID, Sales, Quantity, or numeric column
      const orderCol = cols.find(c => c.name.toLowerCase() === 'order_id');
      const salesCol = cols.find(c => c.name.toLowerCase() === 'sales');
      const numCol = cols.find(c => c.dataType === 'integer' || c.dataType === 'numeric');
      const defaultMeasure = orderCol?.name || salesCol?.name || numCol?.name || (cols[1]?.name || cols[0].name);

      const initialAgg = orderCol || !numCol ? 'count' : 'sum';

      setRawSelectedMeasure(defaultMeasure);

      const initialConfig: ChartConfig = {
        ...config,
        chartType: 'bar',
        xAxis: defaultX,
        yAxis: defaultMeasure,
        aggregation: initialAgg,
        sortOrder: 'desc',
        limit: 50,
        title: `${currentDataset.name} - ${defaultX} by ${defaultMeasure}`
      };

      setConfig(initialConfig);
      executeAnalyticalQuery(currentDataset, initialConfig, defaultMeasure);
    }
  }, [currentDataset?.datasetId, dataSourceMode]);

  // Handle dataset switching
  const handleSwitchDataset = (newDs: ImportedDataset) => {
    setSelectedDatasetId(newDs.datasetId);
    onSelectDataset?.(newDs);
    setInternalQueryResult(null);

    // Refresh columns & clear invalid previous dimension/measures
    const cols = newDs.columns;
    const hasX = cols.some(c => c.name === config.xAxis);
    const hasMeasure = cols.some(c => c.name === rawSelectedMeasure);

    const regionCol = cols.find(c => c.name.toLowerCase() === 'region');
    const textCol = cols.find(c => c.dataType === 'text' || c.dataType === 'date');
    const nextX = hasX ? config.xAxis : (regionCol?.name || textCol?.name || cols[0]?.name || '');

    const orderCol = cols.find(c => c.name.toLowerCase() === 'order_id');
    const numCol = cols.find(c => c.dataType === 'integer' || c.dataType === 'numeric');
    const nextMeasure = hasMeasure ? rawSelectedMeasure : (orderCol?.name || numCol?.name || cols[0]?.name || '');

    setRawSelectedMeasure(nextMeasure);

    const nextConfig: ChartConfig = {
      ...config,
      xAxis: nextX,
      yAxis: nextMeasure,
      secondaryMeasures: [],
      title: `${newDs.name} Overview`
    };

    setConfig(nextConfig);
    executeAnalyticalQuery(newDs, nextConfig, nextMeasure);
  };

  // Re-run query when config dimensions, measures, aggregation, chartType change
  const handleChangeConfig = (newConfig: ChartConfig) => {
    setConfig(newConfig);
    if (dataSourceMode === 'imported' && currentDataset) {
      executeAnalyticalQuery(currentDataset, newConfig);
    }
  };

  // 4. Validate current configuration
  const validation = useMemo(() => {
    const columnsToValidate = detectedColumns.length > 0 ? detectedColumns : datasetColumns;
    return ChartRecommender.validateConfig(config, columnsToValidate);
  }, [config, detectedColumns, datasetColumns]);

  // 5. Process chart data with safe NULL handling and sorting
  const processedData = useMemo(() => {
    if (!effectiveQueryResult || !effectiveQueryResult.rows) return [];
    return VisualizationDataProcessor.process(effectiveQueryResult.rows, config, detectedColumns);
  }, [effectiveQueryResult, config, detectedColumns]);

  // Ask AI for Chart Recommendation
  const handleAskAiForChart = async () => {
    const cols = detectedColumns.length > 0 ? detectedColumns : datasetColumns;
    if (cols.length === 0) return;
    setIsAiRecommending(true);
    try {
      const rowCount = effectiveQueryResult?.rowCount || currentDataset?.rowCount || 100;
      const rec = ChartRecommender.recommend(cols, rowCount);
      const defaultY = rec.yAxis || cols.find(c => c.isNumeric)?.name || '';
      const defaultX = rec.xAxis || cols.find(c => !c.isNumeric || c.isDateOrTime)?.name || '';

      const updated: ChartConfig = {
        ...config,
        chartType: rec.chartType,
        xAxis: defaultX,
        yAxis: defaultY,
        secondaryMeasures: rec.secondaryMeasures || [],
        title: rec.title || config.title,
        subtitle: rec.reason
      };

      setConfig(updated);
      if (dataSourceMode === 'imported' && currentDataset) {
        executeAnalyticalQuery(currentDataset, updated, defaultY);
      }
    } finally {
      setIsAiRecommending(false);
    }
  };

  // Generate factual insights
  const handleGenerateInsights = async () => {
    if (!effectiveQueryResult || !effectiveQueryResult.rows) return;
    setIsInsightsOpen(true);
    setIsGeneratingInsights(true);
    try {
      const results = await VisualizationInsightsService.generateInsights(
        effectiveQueryResult.query || generatedSql || '',
        effectiveQueryResult.rows,
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
      sourceQueryId: effectiveQueryResult?.sourceQueryId,
      querySql: effectiveQueryResult?.query || generatedSql,
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
    if (dataSourceMode === 'imported' && currentDataset) {
      executeAnalyticalQuery(currentDataset, saved.config);
    }
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
      console.error('Failed to export chart as image:', err);
    }
  };

  const handleExportCsv = () => {
    if (!effectiveQueryResult) return;
    VisualizationExportService.exportToCsv(
      config.title.toLowerCase().replace(/\s+/g, '_') || 'chart_data',
      effectiveQueryResult.columns,
      effectiveQueryResult.rows
    );
  };

  const handleCopyConfig = async () => {
    const success = await VisualizationExportService.copyConfig(config);
    if (success) {
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  };

  const handleCopySql = async () => {
    if (!generatedSql) return;
    await navigator.clipboard.writeText(generatedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Check data availability
  const hasImportedData = Boolean(currentDataset || (importedDatasets && importedDatasets.length > 0));
  const hasDbConnection = Boolean(isConnected);

  // 1. Neither connected nor imported
  if (!hasImportedData && !hasDbConnection) {
    return (
      <div id="vis-empty-state" className="flex-1 flex flex-col items-center justify-center h-full bg-slate-950 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <Layers className="w-7 h-7 text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-200">No data source available.</h2>
        <p className="text-xs text-slate-400 max-w-md mt-1 mb-6">
          Connect a database or import a dataset to create visualizations.
        </p>
        <div className="flex items-center space-x-3">
          {onOpenConnectModal && (
            <button
              id="btn-vis-connect-db"
              onClick={onOpenConnectModal}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 transition-all"
            >
              <Database className="w-4 h-4" />
              <span>Connect Database</span>
            </button>
          )}
          {onOpenImportModal && (
            <button
              id="btn-vis-import-dataset"
              onClick={onOpenImportModal}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/20 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import Dataset</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Database only mode, but no query result yet
  if (!hasImportedData && hasDbConnection && (!effectiveQueryResult || effectiveQueryResult.rows.length === 0)) {
    return (
      <div id="vis-no-query-data" className="flex-1 flex flex-col items-center justify-center h-full bg-slate-950 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <BarChart2 className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-200">No data available for visualization.</h2>
        <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
          Execute a query in the <span className="text-indigo-400 font-medium">SQL Editor</span> or run an operation in the <span className="text-emerald-400 font-medium">Analysis Toolkit</span> to visualize live database results.
        </p>
        {onOpenImportModal && (
          <button
            onClick={onOpenImportModal}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Or import a CSV/XLSX/JSON file</span>
          </button>
        )}
      </div>
    );
  }

  const isTruncated = Boolean(effectiveQueryResult?.isTruncated || effectiveQueryResult?.truncated);

  return (
    <div
      id="visualization-workspace"
      className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-950 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'relative'
      }`}
    >
      {/* Top Controls Toolbar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs z-10 flex-shrink-0">
        {/* Left: View Mode Toggle & Data Source Badge */}
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

          {/* Toggle between Imported Dataset & Connected Database when both exist */}
          {hasImportedData && hasDbConnection && (
            <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
              <button
                id="btn-switch-source-imported"
                onClick={() => setDataSourceMode('imported')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  dataSourceMode === 'imported'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Imported Datasets ({importedDatasets.length})
              </button>
              <button
                id="btn-switch-source-db"
                onClick={() => setDataSourceMode('database')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  dataSourceMode === 'database'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Database
              </button>
            </div>
          )}

          {/* Data Source Badge: Imported Dataset Details */}
          {dataSourceMode === 'imported' && currentDataset ? (
            <div id="vis-dataset-source-badge" className="flex items-center space-x-2 bg-slate-950/80 border border-emerald-500/30 rounded-lg px-2.5 py-1 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Data Source:</span>
                <span className="text-slate-300 font-medium text-[11px]">Imported Dataset</span>
              </div>
              <span className="text-slate-600">•</span>
              {importedDatasets.length > 1 ? (
                <select
                  id="select-imported-dataset-vis"
                  value={currentDataset.datasetId}
                  onChange={e => {
                    const found = importedDatasets.find(d => d.datasetId === e.target.value);
                    if (found) handleSwitchDataset(found);
                  }}
                  className="bg-slate-900 border border-slate-700 text-emerald-300 rounded px-1.5 py-0.5 text-xs font-mono font-medium focus:outline-none focus:border-emerald-500"
                >
                  {importedDatasets.map(ds => (
                    <option key={ds.datasetId} value={ds.datasetId}>
                      {ds.name} ({ds.tableName})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono text-emerald-300 font-semibold">{currentDataset.tableName}</span>
              )}
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-mono text-[11px]">{currentDataset.rowCount.toLocaleString()} rows</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono text-[11px]">{currentDataset.columns.length} columns</span>
              {effectiveQueryResult && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-mono text-[10px]">{effectiveQueryResult.executionTimeMs}ms</span>
                </>
              )}
            </div>
          ) : effectiveQueryResult ? (
            /* Database Query Result Info */
            <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
              <span className="font-mono text-slate-200 font-medium">{effectiveQueryResult.rowCount.toLocaleString()}</span>
              <span>records</span>
              <span>•</span>
              <span className="font-mono text-slate-200">{effectiveQueryResult.columns.length}</span>
              <span>columns</span>
              <span>•</span>
              <span className="font-mono">{effectiveQueryResult.executionTimeMs}ms</span>
            </div>
          ) : null}
        </div>

        {/* Right: Actions (SQL Preview, Insights, Save, Export, Fullscreen) */}
        <div className="flex items-center space-x-2">
          {/* Generated SQL Preview Toggle */}
          {generatedSql && (
            <button
              id="btn-toggle-sql-preview"
              onClick={() => setIsSqlPreviewOpen(prev => !prev)}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isSqlPreviewOpen
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
              }`}
              title="View generated SQLite SQL query"
            >
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>SQL</span>
              {isSqlPreviewOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {/* Refresh Query Button */}
          {dataSourceMode === 'imported' && currentDataset && (
            <button
              id="btn-refresh-vis-query"
              onClick={() => executeAnalyticalQuery(currentDataset, config)}
              disabled={isQueryLoading}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh visualization query"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isQueryLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}

          {/* Generate Insights Button */}
          <button
            id="btn-generate-insights"
            onClick={handleGenerateInsights}
            disabled={!effectiveQueryResult || isGeneratingInsights}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition-colors disabled:opacity-50"
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
              onClick={() => {
                const resToPass = effectiveQueryResult || {
                  query: generatedSql,
                  columns: datasetColumns.map(c => ({ name: c.name, dataType: c.dataType })),
                  rows: [],
                  rowCount: currentDataset?.rowCount || 0,
                  executionTimeMs: 0,
                  status: 'success'
                };
                onAddToDashboard(
                  config,
                  resToPass,
                  currentDataset?.tableName || selectedTable?.name,
                  currentDataset?.datasetId
                );
              }}
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

      {/* Collapsible Generated SQL Banner */}
      {isSqlPreviewOpen && generatedSql && (
        <div id="vis-sql-preview-drawer" className="bg-slate-900/95 border-b border-slate-800 px-4 py-2.5 flex flex-col space-y-1.5 text-xs flex-shrink-0 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>Server-Side Aggregated SQLite Query</span>
            </span>
            <button
              onClick={handleCopySql}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              <span>{copiedSql ? 'Copied' : 'Copy SQL'}</span>
            </button>
          </div>
          <pre className="font-mono text-[11px] text-emerald-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-x-auto">
            {generatedSql}
          </pre>
        </div>
      )}

      {/* Query Error Banner */}
      {queryError && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 flex items-center justify-between text-rose-300 text-xs flex-shrink-0">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{queryError}</span>
          </div>
          {currentDataset && (
            <button
              onClick={() => executeAnalyticalQuery(currentDataset, config)}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Truncated Result Protection Banner */}
      {isTruncated && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center space-x-2 text-amber-300 text-xs flex-shrink-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
          <span>Visualization uses the available result set. Query result was limited.</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Configuration Panel (Hidden in Table Mode) */}
        {activeViewMode === 'chart' && (
          <ChartConfigPanel
            config={config}
            onChangeConfig={handleChangeConfig}
            columns={datasetColumns.length > 0 ? datasetColumns : detectedColumns}
            validation={validation}
            onAskAiForChart={handleAskAiForChart}
            isAiLoading={isAiRecommending}
          />
        )}

        {/* Center: Stage Canvas */}
        <div className="flex-1 flex flex-col h-full overflow-hidden p-4 min-w-0 relative">
          {/* Query Loading Overlay */}
          {isQueryLoading && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-20">
              <div className="flex items-center space-x-2.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 shadow-xl text-slate-200 text-xs">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>Aggregating dataset records...</span>
              </div>
            </div>
          )}

          {activeViewMode === 'table' ? (
            effectiveQueryResult ? (
              <TableView columns={effectiveQueryResult.columns} rows={effectiveQueryResult.rows} />
            ) : (
              <div className="text-center p-8 text-slate-400">No tabular data to display.</div>
            )
          ) : (
            <div
              ref={chartContainerRef}
              id="chart-display-canvas"
              className="w-full h-full bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col shadow-inner relative overflow-hidden"
            >
              {/* Chart Header */}
              <div className="mb-4 flex-shrink-0 flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {config.title || 'Data Visualization'}
                  </h3>
                  {config.subtitle && (
                    <p className="text-xs text-slate-400 mt-0.5">{config.subtitle}</p>
                  )}
                </div>
                {effectiveQueryResult && (
                  <div className="text-[11px] font-mono text-slate-400">
                    {effectiveQueryResult.rowCount.toLocaleString()} aggregated data point{effectiveQueryResult.rowCount === 1 ? '' : 's'}
                  </div>
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
                ) : !effectiveQueryResult || effectiveQueryResult.rows.length === 0 ? (
                  <div className="text-center p-8 max-w-md text-slate-400 text-xs">
                    No records matched the analytical query. Adjust dimensions or filters.
                  </div>
                ) : config.chartType === 'kpi' ? (
                  <KpiCardView rows={effectiveQueryResult.rows} config={config} />
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
                  <HistogramView rows={effectiveQueryResult.rows} config={config} />
                ) : (
                  <TableView columns={effectiveQueryResult.columns} rows={effectiveQueryResult.rows} />
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
