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
  Table2
} from 'lucide-react';
import { ImportedDataset, ExportFormat } from '../../types/import';
import { TransformStep, CleaningPreviewResult, CleaningTabId } from '../../types/cleaning';
import { CleaningApiClient } from '../../services/cleaningApi';
import { CleaningOverviewTab } from './tabs/CleaningOverviewTab';
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
  onSelectDataset: (dataset: ImportedDataset) => void;
  onDatasetCreated?: (newDataset: ImportedDataset) => void;
}

export const DataCleaningWorkspace: React.FC<DataCleaningWorkspaceProps> = ({
  dataset,
  allDatasets,
  onSelectDataset,
  onDatasetCreated
}) => {
  const [activeTab, setActiveTab] = useState<CleaningTabId>('overview');
  const [pipeline, setPipeline] = useState<TransformStep[]>([]);
  const [undoStack, setUndoStack] = useState<TransformStep[][]>([]);
  const [redoStack, setRedoStack] = useState<TransformStep[][]>([]);
  const [preview, setPreview] = useState<CleaningPreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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
    if (!dataset) return;
    setIsLoadingPreview(true);
    setStatusMessage(null);
    try {
      const res = await CleaningApiClient.previewPipeline(dataset.datasetId, pipeline);
      setPreview(res);
      setStatusMessage({
        type: 'success',
        text: `Preview generated: ${res.affectedRowCount} rows affected, DQ score ${res.qualityBefore?.overallQualityScore} → ${res.qualityAfter?.overallQualityScore}.`
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
    if (!dataset) return;
    const res = await CleaningApiClient.saveCleanedDataset(dataset.datasetId, newName, pipeline);
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
    if (!dataset) return;
    await CleaningApiClient.exportCleanedData(dataset.datasetId, pipeline, format, customName);
    setStatusMessage({ type: 'success', text: `Exported cleaned dataset in .${format.toUpperCase()} format.` });
  };

  if (!dataset) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-950">
        <Database className="w-12 h-12 text-slate-600 mb-4 animate-pulse" />
        <h3 className="text-lg font-semibold text-white">No Dataset Selected for Cleaning</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md">
          Please import a CSV, Excel, or JSON dataset or choose an active dataset from the sidebar to launch the Data Cleaning Workspace.
        </p>
        {allDatasets.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {allDatasets.map(d => (
              <button
                key={d.datasetId}
                onClick={() => onSelectDataset(d)}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-200 transition-colors"
              >
                {d.name} ({d.rowCount} rows)
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const activeStepsCount = pipeline.filter(s => s.enabled).length;

  const tabs: { id: CleaningTabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview & Health', icon: <Sparkles className="w-4 h-4" /> },
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
        {/* Left: Dataset info and status indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-white text-sm">Data Cleaning & Transformation</span>
          </div>

          {/* Dataset Selector Dropdown */}
          <select
            value={dataset.datasetId}
            onChange={e => {
              const selected = allDatasets.find(d => d.datasetId === e.target.value);
              if (selected) {
                onSelectDataset(selected);
                setPipeline([]);
                setPreview(null);
              }
            }}
            className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-hidden"
          >
            {allDatasets.map(d => (
              <option key={d.datasetId} value={d.datasetId}>
                {d.name} ({d.rowCount} rows, {d.columns.length} cols)
              </option>
            ))}
          </select>

          {/* Non-destructive guarantee badges */}
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            Original: Read-Only
          </span>

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
          className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-900 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/80 border-rose-900 text-rose-200'
              : 'bg-indigo-950/80 border-indigo-900 text-indigo-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-900/40 px-4 overflow-x-auto no-scrollbar">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3.5 text-xs font-medium flex items-center space-x-2 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-indigo-500 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <CleaningOverviewTab
            dataset={dataset}
            pipeline={pipeline}
            preview={preview}
            onAddQuickStep={handleAddStep}
            onNavigateTab={tabId => setActiveTab(tabId as CleaningTabId)}
          />
        )}

        {activeTab === 'columns' && (
          <ColumnOperationsTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'calculated' && (
          <CalculatedColumnTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'conditional' && (
          <ConditionalColumnTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'filter' && (
          <RowFilterTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'sort-rank' && (
          <SortRankTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'date-transforms' && (
          <DateTransformationsTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'pivot-unpivot' && (
          <PivotUnpivotTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'missing' && (
          <MissingValuesTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'duplicates' && (
          <DuplicatesTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'types' && (
          <DataTypesTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'dates' && (
          <DateStandardizationTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'text' && (
          <TextCleaningTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'numeric' && (
          <NumericCleaningTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'mapping' && (
          <ValueMappingTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'outliers' && (
          <OutliersTab dataset={dataset} onAddStep={handleAddStep} />
        )}

        {activeTab === 'pipeline' && (
          <PipelineTab
            pipeline={pipeline}
            onToggleStep={handleToggleStep}
            onRemoveStep={handleRemoveStep}
            onMoveStep={handleMoveStep}
            onClearAll={handleClearAll}
            onPreview={handleRunPreview}
            isLoadingPreview={isLoadingPreview}
          />
        )}

        {activeTab === 'preview' && (
          <PreviewDiffTab
            dataset={dataset}
            preview={preview}
            onRunPreview={handleRunPreview}
            isLoading={isLoadingPreview}
          />
        )}
      </div>

      {/* Save / Export Modal */}
      {showSaveModal && (
        <SaveCleanedDatasetModal
          dataset={dataset}
          pipeline={pipeline}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveCleaned}
          onExport={handleExportCleaned}
        />
      )}
    </div>
  );
};
