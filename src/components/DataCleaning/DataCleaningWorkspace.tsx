import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Layers,
  Eye,
  RotateCcw,
  Undo2,
  Redo2,
  Save,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Filter,
  Copy,
  RefreshCw,
  Calendar,
  Type,
  DollarSign,
  Wand2,
  Database,
  Columns,
  Calculator,
  GitBranch,
  ArrowUpDown,
  Table2,
  FileText,
  FileSpreadsheet,
  Code,
  Search,
  ArrowRight,
  Plug,
  Loader2,
  Lock
} from 'lucide-react';
import { ImportedDataset, ExportFormat } from '../../types/import';
import { TransformStep, CleaningPreviewResult, CleaningTabId } from '../../types/cleaning';
import { DiscoveredTable, SanitizedConnectionInfo } from '../../types/database';
import { CleaningApiClient } from '../../services/cleaningApi';
import { CleaningOverviewTab } from './tabs/CleaningOverviewTab';
import { AiCleaningAssistantTab } from './tabs/AiCleaningAssistantTab';
import { MissingValuesTab } from './tabs/MissingValuesTab';
import { DuplicatesTab } from './tabs/DuplicatesTab';
import { DataTypesTab } from './tabs/DataTypesTab';
import { DateStandardizationTab } from './tabs/DateStandardizationTab';
import { TextCleaningTab } from './tabs/TextCleaningTab';
import { NumericCleaningTab } from './tabs/NumericCleaningTab';
import { ValueMappingTab } from './tabs/ValueMappingTab';
import { OutliersTab } from './tabs/OutliersTab';
import { ColumnOperationsTab } from './tabs/ColumnOperationsTab';
import { CalculatedColumnTab } from './tabs/CalculatedColumnTab';
import { ConditionalColumnTab } from './tabs/ConditionalColumnTab';
import { RowFilterTab } from './tabs/RowFilterTab';
import { SortRankTab } from './tabs/SortRankTab';
import { DateTransformationsTab } from './tabs/DateTransformationsTab';
import { PivotUnpivotTab } from './tabs/PivotUnpivotTab';
import { PipelineTab } from './tabs/PipelineTab';
import { PreviewDiffTab } from './tabs/PreviewDiffTab';
import { SaveCleanedDatasetModal } from './SaveCleanedDatasetModal';

interface DataCleaningWorkspaceProps {
  dataset: ImportedDataset | null;
  allDatasets: ImportedDataset[];
  tables?: DiscoveredTable[];
  selectedTable?: DiscoveredTable | null;
  connection?: SanitizedConnectionInfo | null;
  onSelectDataset: (dataset: ImportedDataset) => void;
  onSelectTable?: (table: DiscoveredTable) => void;
  onDatasetCreated?: (newDataset: ImportedDataset) => void;
  onOpenImportModal?: () => void;
  onOpenConnectModal?: () => void;
  onBrowseSampleDatasets?: () => void;
  onLearnMore?: () => void;
}

export const DataCleaningWorkspace: React.FC<DataCleaningWorkspaceProps> = ({
  dataset,
  allDatasets,
  tables = [],
  selectedTable,
  connection,
  onSelectDataset,
  onSelectTable,
  onDatasetCreated,
  onOpenImportModal,
  onOpenConnectModal,
  onBrowseSampleDatasets,
  onLearnMore
}) => {
  const [activeSource, setActiveSource] = useState<ImportedDataset | null>(dataset);
  const [activeTab, setActiveTab] = useState<CleaningTabId>('overview');
  const [pipeline, setPipeline] = useState<TransformStep[]>([]);
  const [undoStack, setUndoStack] = useState<TransformStep[][]>([]);
  const [redoStack, setRedoStack] = useState<TransformStep[][]>([]);
  const [preview, setPreview] = useState<CleaningPreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'all' | 'imported' | 'database'>('all');

  // Filter actual database tables (excluding 'imported' schema)
  const databaseTables = tables.filter(t => t.schema !== 'imported');

  // Sync activeSource when dataset prop changes
  useEffect(() => {
    if (dataset) {
      setActiveSource(dataset);
    }
  }, [dataset]);

  // Load database table as cleaning source
  const handleSelectDatabaseTable = async (table: DiscoveredTable) => {
    setIsLoadingSource(true);
    setStatusMessage(null);
    try {
      const sourceId = `db:${table.schema}:${table.name}`;
      const sourceDetails = await CleaningApiClient.getSourceDetails(sourceId);
      setActiveSource(sourceDetails);
      setPipeline([]);
      setPreview(null);
      setUndoStack([]);
      setRedoStack([]);
      setActiveTab('overview');
      if (onSelectTable) {
        onSelectTable(table);
      }
      setStatusMessage({
        type: 'info',
        text: `Loaded database table "${table.schema}.${table.name}" for non-destructive cleaning.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || `Failed to load database table "${table.schema}.${table.name}".`
      });
    } finally {
      setIsLoadingSource(false);
    }
  };

  // Switch to an imported dataset
  const handleSelectImportedDataset = (ds: ImportedDataset) => {
    setActiveSource(ds);
    setPipeline([]);
    setPreview(null);
    setUndoStack([]);
    setRedoStack([]);
    setActiveTab('overview');
    onSelectDataset(ds);
  };

  // Auto-clear message after 5s
  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [statusMessage]);

  // Push to undo stack before mutating pipeline
  const pushUndoState = useCallback((newPipeline: TransformStep[]) => {
    setUndoStack(prev => [...prev.slice(-20), pipeline]);
    setRedoStack([]);
    setPipeline(newPipeline);
  }, [pipeline]);

  const handleAddStep = (step: TransformStep) => {
    pushUndoState([...pipeline, step]);
    setStatusMessage({ type: 'info', text: `Added "${step.description}" to pipeline.` });
  };

  const handleAddMultipleSteps = (newSteps: TransformStep[]) => {
    pushUndoState([...pipeline, ...newSteps]);
    setStatusMessage({ type: 'info', text: `Added ${newSteps.length} steps to pipeline.` });
  };

  const handleToggleStep = (stepId: string) => {
    const updated = pipeline.map(s => s.id === stepId ? { ...s, enabled: !s.enabled } : s);
    pushUndoState(updated);
  };

  const handleRemoveStep = (stepId: string) => {
    const updated = pipeline.filter(s => s.id !== stepId);
    pushUndoState(updated);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= pipeline.length) return;
    const copy = [...pipeline];
    const item = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = item;
    pushUndoState(copy);
  };

  const handleUpdatePipeline = (newPipeline: TransformStep[], actionMsg?: string) => {
    pushUndoState(newPipeline);
    if (actionMsg) {
      setStatusMessage({ type: 'info', text: actionMsg });
    }
  };

  const handleDuplicateStep = (index: number) => {
    if (index < 0 || index >= pipeline.length) return;
    const stepToDup = pipeline[index];
    const newStep: TransformStep = {
      ...stepToDup,
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      description: `${stepToDup.description} (Copy)`,
      createdAt: new Date().toISOString()
    };
    const updated = [...pipeline.slice(0, index + 1), newStep, ...pipeline.slice(index + 1)];
    pushUndoState(updated);
    setStatusMessage({ type: 'info', text: `Duplicated step "${stepToDup.description}".` });
  };

  const handleEditStep = (index: number, updatedStep: TransformStep) => {
    if (index < 0 || index >= pipeline.length) return;
    const updated = [...pipeline];
    updated[index] = updatedStep;
    pushUndoState(updated);
    setStatusMessage({ type: 'info', text: `Updated step "${updatedStep.description}".` });
  };

  const handleClearAll = () => {
    pushUndoState([]);
    setPreview(null);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack(r => [...r, pipeline]);
    setPipeline(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack(u => [...u, pipeline]);
    setPipeline(next);
  };

  const handleRestoreOriginal = () => {
    pushUndoState([]);
    setPreview(null);
    setStatusMessage({ type: 'info', text: 'Restored original working state.' });
  };

  // Run preview on backend
  const handleRunPreview = async () => {
    if (!activeSource) return;
    setIsLoadingPreview(true);
    setStatusMessage(null);
    try {
      const res = await CleaningApiClient.previewPipeline(activeSource.datasetId, pipeline);
      setPreview(res);
      setStatusMessage({
        type: 'success',
        text: `Preview generated: ${res.affectedRowCount} rows affected, DQ score ${res.qualityBefore?.overallQualityScore || 100} → ${res.qualityAfter?.overallQualityScore || 100}.`
      });
      setActiveTab('preview');
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to generate preview.' });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Save cleaned dataset
  const handleSaveCleaned = async (newName: string) => {
    if (!activeSource) return;
    const res = await CleaningApiClient.saveCleanedDataset(activeSource.datasetId, newName, pipeline);
    setStatusMessage({
      type: 'success',
      text: res.message || `Cleaned dataset "${newName}" created successfully!`
    });
    if (onDatasetCreated) {
      onDatasetCreated(res.newDataset);
    }
  };

  // Export cleaned data
  const handleExportCleaned = async (format: ExportFormat, customName?: string) => {
    if (!activeSource) return;
    await CleaningApiClient.exportCleanedData(activeSource.datasetId, pipeline, format, customName);
    setStatusMessage({ type: 'success', text: `Exported cleaned dataset in .${format.toUpperCase()} format.` });
  };

  // Filtered tables for empty state selector
  const filteredDatabaseTables = databaseTables.filter(t =>
    t.name.toLowerCase().includes(tableSearchTerm.toLowerCase()) ||
    t.schema.toLowerCase().includes(tableSearchTerm.toLowerCase())
  );

  // If loading source metadata
  if (isLoadingSource) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 text-center">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
        <h4 className="text-base font-semibold text-white">Loading Data Source Schema...</h4>
        <p className="text-xs text-slate-400 mt-1">Inspecting columns, generating data quality profile, and preparing non-destructive working copy.</p>
      </div>
    );
  }

  // If no dataset or database table is actively loaded, display the comprehensive Source Selection View
  if (!activeSource) {
    return (
      <div className="flex-1 flex flex-col items-center justify-start p-6 md:p-10 bg-slate-950 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto flex flex-col items-center text-center">
          {/* Main header */}
          <div className="w-14 h-14 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-center mb-4 text-indigo-400 shadow-lg">
            <Sparkles className="w-7 h-7" />
          </div>

          <h3 className="text-2xl font-bold text-white tracking-tight">Select a Data Source for Cleaning</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
            Choose an imported file dataset or select a table from your connected database. All cleaning transformations are strictly non-destructive and preserve your source data.
          </p>

          {/* Two-Column Grid: Imported Datasets vs Connected Database Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 w-full text-left">
            {/* Column 1: Imported File Datasets */}
            <div className="flex flex-col bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Imported Datasets</h4>
                    <p className="text-[11px] text-slate-400">CSV, Excel, or JSON files in workspace</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {allDatasets.length} available
                </span>
              </div>

              {/* Existing Imported Datasets List */}
              {allDatasets.length > 0 ? (
                <div className="mt-4 flex-1 flex flex-col">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Available Workspace Datasets
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {allDatasets.map(d => (
                      <div
                        key={d.datasetId}
                        className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 transition-all flex items-center justify-between group"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-medium text-white truncate">{d.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-slate-800 text-slate-300">
                              {d.fileType}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {d.rowCount?.toLocaleString()} rows • {d.columns?.length} columns
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectImportedDataset(d)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 text-xs font-medium text-indigo-300 hover:text-white transition-colors flex items-center space-x-1"
                        >
                          <span>Clean</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="my-6 p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center">
                  <p className="text-xs text-slate-400">No imported datasets yet in this workspace.</p>
                </div>
              )}

              {/* Import Action Buttons */}
              <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenImportModal?.()}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-center transition-colors flex flex-col items-center group"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-medium text-slate-200">Import CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenImportModal?.()}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-center transition-colors flex flex-col items-center group"
                >
                  <FileText className="w-4 h-4 text-blue-400 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-medium text-slate-200">Import Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenImportModal?.()}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-center transition-colors flex flex-col items-center group"
                >
                  <Code className="w-4 h-4 text-purple-400 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-medium text-slate-200">Import JSON</span>
                </button>
              </div>

              {/* Sample datasets trigger */}
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => onBrowseSampleDatasets ? onBrowseSampleDatasets() : onOpenImportModal?.()}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Browse Sample Clean/Messy Datasets</span>
                </button>
              </div>
            </div>

            {/* Column 2: Connected Database Tables */}
            <div className="flex flex-col bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Database Tables</h4>
                    <p className="text-[11px] text-slate-400">Connected SQL database tables</p>
                  </div>
                </div>
                {connection?.isConnected ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-900/50 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                    <span>{connection.type.toUpperCase()} Connected</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Not Connected
                  </span>
                )}
              </div>

              {/* If Database is Connected */}
              {connection?.isConnected ? (
                <div className="mt-4 flex-1 flex flex-col">
                  {/* Table Search */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={tableSearchTerm}
                      onChange={e => setTableSearchTerm(e.target.value)}
                      placeholder="Search database tables..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  {/* Database Tables List */}
                  {filteredDatabaseTables.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {filteredDatabaseTables.map(t => (
                        <div
                          key={`${t.schema}.${t.name}`}
                          className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-blue-500/50 transition-all flex items-center justify-between group"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-medium text-white truncate">
                                {t.schema !== 'public' ? `${t.schema}.${t.name}` : t.name}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-blue-950/60 text-blue-300 border border-blue-900/40">
                                {t.type}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              ~{t.approximateRowCount?.toLocaleString() || 0} rows • Read-Only Source
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectDatabaseTable(t)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-xs font-medium text-blue-300 hover:text-white transition-colors flex items-center space-x-1"
                          >
                            <span>Clean Table</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="my-6 p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center">
                      <p className="text-xs text-slate-400">No database tables match your search.</p>
                    </div>
                  )}

                  {/* Database Read-Only Guard Info */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-start space-x-2 text-[11px] text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-200">Database Guard Active:</strong> Cleaning operates safely in a session copy. Your real database tables remain 100% read-only and will never be modified.
                    </div>
                  </div>
                </div>
              ) : (
                /* If NO database is connected */
                <div className="mt-4 flex-1 flex flex-col justify-between">
                  <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center my-auto">
                    <Plug className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <h5 className="text-xs font-semibold text-white">No Database Connected</h5>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      Connect PostgreSQL, MySQL, SQLite, Oracle, or SQL Server to clean and transform database tables non-destructively.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenConnectModal?.()}
                      className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors inline-flex items-center space-x-1.5 shadow-xs"
                    >
                      <Plug className="w-3.5 h-3.5" />
                      <span>Connect Database</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Informational Link */}
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                if (onLearnMore) {
                  onLearnMore();
                } else {
                  alert('DataPilot Data Cleaning Workspace provides robust non-destructive pipeline transformations, automated missing value imputation, text normalization, type casting, outlier filtering, calculated columns, and Gemini AI auto-cleaning recommendations for both file datasets and connected SQL databases.');
                }
              }}
              className="text-xs text-slate-400 hover:text-cyan-300 underline underline-offset-4 transition-colors"
            >
              Learn more about non-destructive data cleaning & transformation pipelines
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeStepsCount = pipeline.filter(s => s.enabled).length;

  const tabs: { id: CleaningTabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview & Health', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'ai-assistant', label: 'AI Assistant', icon: <Wand2 className="w-4 h-4 text-indigo-400" /> },
    { id: 'columns', label: 'Column Ops', icon: <Columns className="w-4 h-4" /> },
    { id: 'calculated', label: 'Calculated Columns', icon: <Calculator className="w-4 h-4" /> },
    { id: 'conditional', label: 'Conditional Columns', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'filter', label: 'Row Filter', icon: <Filter className="w-4 h-4" /> },
    { id: 'sort-rank', label: 'Sort & Rank', icon: <ArrowUpDown className="w-4 h-4" /> },
    { id: 'date-transforms', label: 'Date Transforms', icon: <Calendar className="w-4 h-4" /> },
    { id: 'pivot-unpivot', label: 'Pivot / Unpivot', icon: <Table2 className="w-4 h-4" /> },
    { id: 'missing', label: 'Missing Values', icon: <Filter className="w-4 h-4" /> },
    { id: 'duplicates', label: 'Duplicates', icon: <Copy className="w-4 h-4" /> },
    { id: 'types', label: 'Data Types', icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'dates', label: 'Date Standards', icon: <Calendar className="w-4 h-4" /> },
    { id: 'text', label: 'Text Cleaning', icon: <Type className="w-4 h-4" /> },
    { id: 'numeric', label: 'Numeric & Currency', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'mapping', label: 'Value Mapping', icon: <Wand2 className="w-4 h-4" /> },
    { id: 'outliers', label: 'Outliers', icon: <Activity className="w-4 h-4" /> },
    { id: 'pipeline', label: 'Pipeline Steps', icon: <Layers className="w-4 h-4" />, badge: activeStepsCount },
    { id: 'preview', label: 'Diff Preview', icon: <Eye className="w-4 h-4" /> }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Source switcher and status indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-white text-sm">Data Cleaning & Transformation</span>
          </div>

          {/* Source Selector (Imported Datasets & Database Tables) */}
          <div className="flex items-center space-x-1.5">
            <select
              value={activeSource.datasetId}
              onChange={e => {
                const val = e.target.value;
                if (val.startsWith('db:')) {
                  const parts = val.replace(/^db:/, '').split(':');
                  const foundTable = databaseTables.find(t => t.schema === parts[0] && t.name === parts[1]);
                  if (foundTable) {
                    handleSelectDatabaseTable(foundTable);
                  }
                } else {
                  const foundDs = allDatasets.find(d => d.datasetId === val);
                  if (foundDs) {
                    handleSelectImportedDataset(foundDs);
                  }
                }
              }}
              className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-750 text-xs font-mono text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              {allDatasets.length > 0 && (
                <optgroup label="Imported Datasets">
                  {allDatasets.map(d => (
                    <option key={d.datasetId} value={d.datasetId}>
                      [Imported] {d.name} ({d.rowCount} rows)
                    </option>
                  ))}
                </optgroup>
              )}

              {databaseTables.length > 0 && (
                <optgroup label="Connected Database Tables">
                  {databaseTables.map(t => (
                    <option key={`db:${t.schema}:${t.name}`} value={`db:${t.schema}:${t.name}`}>
                      [DB] {t.schema !== 'public' ? `${t.schema}.${t.name}` : t.name} (~{t.approximateRowCount || 0} rows)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* Quick Switch / Change Source Button */}
            <button
              type="button"
              onClick={() => {
                setActiveSource(null);
                setPipeline([]);
                setPreview(null);
              }}
              className="px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Select another dataset or database table"
            >
              Switch Source
            </button>
          </div>

          {/* Non-destructive guarantee badges */}
          {activeSource.sourceType === 'DATABASE' ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/60 text-blue-300 border border-blue-900/50 flex items-center space-x-1">
              <Lock className="w-2.5 h-2.5" />
              <span>DB Source: Read-Only Protected</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
              Imported File: Read-Only
            </span>
          )}

          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-900/50">
            Working Copy: {pipeline.length > 0 ? `${activeStepsCount} rules configured` : 'Clean'}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
            title="Undo last change"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Restore Original */}
          <button
            onClick={handleRestoreOriginal}
            disabled={pipeline.length === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white text-xs font-medium flex items-center space-x-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Original</span>
          </button>

          {/* Preview Changes */}
          <button
            onClick={handleRunPreview}
            disabled={isLoadingPreview}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 text-xs font-semibold flex items-center space-x-1.5 border border-indigo-500/30 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isLoadingPreview ? 'Previewing...' : 'Preview Changes'}</span>
          </button>

          {/* Save / Export modal */}
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save / Export</span>
          </button>
        </div>
      </div>

      {/* Notification status bar */}
      {statusMessage && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between transition-colors border-b ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/80 border-rose-800 text-rose-300'
              : 'bg-indigo-950/80 border-indigo-800 text-indigo-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-[11px] underline hover:no-underline ml-4 opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Vertical Sub-Tab Navigation */}
        <div className="w-full md:w-56 bg-slate-900/50 border-r border-slate-800 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto p-2 gap-1 flex-shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap md:whitespace-normal ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                {tab.icon}
                <span>{tab.label}</span>
              </div>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === tab.id
                      ? 'bg-indigo-800 text-indigo-100'
                      : 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 bg-slate-950">
          {activeTab === 'overview' && (
            <CleaningOverviewTab
              dataset={activeSource}
              pipeline={pipeline}
              preview={preview}
              onAddQuickStep={handleAddStep}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'ai-assistant' && (
            <AiCleaningAssistantTab
              dataset={activeSource}
              pipeline={pipeline}
              onAddStep={handleAddStep}
              onAddMultipleSteps={handleAddMultipleSteps}
              onNavigateToPipeline={() => setActiveTab('pipeline')}
            />
          )}

          {activeTab === 'columns' && (
            <ColumnOperationsTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'calculated' && (
            <CalculatedColumnTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'conditional' && (
            <ConditionalColumnTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'filter' && (
            <RowFilterTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'sort-rank' && (
            <SortRankTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'date-transforms' && (
            <DateTransformationsTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'pivot-unpivot' && (
            <PivotUnpivotTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'missing' && (
            <MissingValuesTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'duplicates' && (
            <DuplicatesTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'types' && (
            <DataTypesTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'dates' && (
            <DateStandardizationTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'text' && (
            <TextCleaningTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'numeric' && (
            <NumericCleaningTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'mapping' && (
            <ValueMappingTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'outliers' && (
            <OutliersTab
              dataset={activeSource}
              onAddStep={handleAddStep}
            />
          )}

          {activeTab === 'pipeline' && (
            <PipelineTab
              dataset={activeSource}
              pipeline={pipeline}
              preview={preview}
              onUpdatePipeline={handleUpdatePipeline}
              onToggleStep={handleToggleStep}
              onRemoveStep={handleRemoveStep}
              onMoveStep={handleMoveStep}
              onDuplicateStep={handleDuplicateStep}
              onEditStep={handleEditStep}
              onClearAll={handleClearAll}
              onPreview={handleRunPreview}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              isLoadingPreview={isLoadingPreview}
            />
          )}

          {activeTab === 'preview' && (
            <PreviewDiffTab
              dataset={activeSource}
              preview={preview}
              onRunPreview={handleRunPreview}
              isLoading={isLoadingPreview}
            />
          )}
        </div>
      </div>

      {/* Save Cleaned Dataset Modal */}
      {showSaveModal && (
        <SaveCleanedDatasetModal
          dataset={activeSource}
          pipeline={pipeline}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveCleaned}
          onExport={handleExportCleaned}
        />
      )}
    </div>
  );
};
