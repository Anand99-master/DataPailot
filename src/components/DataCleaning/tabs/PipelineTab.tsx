import React, { useState } from 'react';
import {
  Layers,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Play,
  Copy,
  Edit2,
  AlertTriangle,
  BookmarkPlus,
  Bookmark,
  ShieldCheck,
  Undo2,
  Redo2,
  Sparkles,
  Info,
  Clock,
  Columns,
  Activity
} from 'lucide-react';
import { TransformStep, CleaningPreviewResult, SavedPipeline, PipelineValidationResult } from '../../../types/cleaning';
import { ImportedDataset } from '../../../types/import';
import { PipelineValidator } from '../../../utils/pipelineValidator';
import { StepEditModal } from '../pipeline/StepEditModal';
import { SavePipelineModal } from '../pipeline/SavePipelineModal';
import { SavedPipelinesModal } from '../pipeline/SavedPipelinesModal';

interface PipelineTabProps {
  dataset: ImportedDataset;
  pipeline: TransformStep[];
  preview: CleaningPreviewResult | null;
  onUpdatePipeline: (newPipeline: TransformStep[], actionMsg?: string) => void;
  onToggleStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onMoveStep: (index: number, direction: 'up' | 'down') => void;
  onDuplicateStep: (index: number) => void;
  onEditStep: (index: number, updatedStep: TransformStep) => void;
  onClearAll: () => void;
  onPreview: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isLoadingPreview?: boolean;
}

export const PipelineTab: React.FC<PipelineTabProps> = ({
  dataset,
  pipeline,
  preview,
  onUpdatePipeline,
  onToggleStep,
  onRemoveStep,
  onMoveStep,
  onDuplicateStep,
  onEditStep,
  onClearAll,
  onPreview,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isLoadingPreview = false
}) => {
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSavedPipelinesModal, setShowSavedPipelinesModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeSavedPipeline, setActiveSavedPipeline] = useState<SavedPipeline | null>(null);

  // Real-time Pipeline Validation
  const validation: PipelineValidationResult = PipelineValidator.validatePipeline(
    dataset.columns,
    pipeline
  );

  const activeStepsCount = pipeline.filter(s => s.enabled).length;
  const disabledStepsCount = pipeline.length - activeStepsCount;
  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;

  const handleApplySavedPipeline = (steps: TransformStep[], saved: SavedPipeline, mode: 'replace' | 'append') => {
    setActiveSavedPipeline(saved);
    if (mode === 'replace') {
      onUpdatePipeline(steps, `Applied saved pipeline "${saved.name}".`);
    } else {
      onUpdatePipeline([...pipeline, ...steps], `Appended steps from "${saved.name}".`);
    }
  };

  const getStepValidation = (stepId: string) => {
    return validation.stepValidations.find(v => v.stepId === stepId);
  };

  const getStepMetric = (stepId: string) => {
    return preview?.stepMetrics?.find(m => m.stepId === stepId);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Overview & Summary KPI Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-900/50 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">Pipeline Sequence & Orchestrator</h3>
                {activeSavedPipeline && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-900">
                    {activeSavedPipeline.name} (v{activeSavedPipeline.version || 1})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Dataset: <span className="text-indigo-300 font-mono font-medium">{dataset.name}</span> ({dataset.rowCount} original rows, {dataset.columns.length} columns)
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Undo / Redo */}
            {onUndo && (
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
                title="Undo last modification"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )}
            {onRedo && (
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-colors"
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            )}

            {/* Load Saved Pipeline */}
            <button
              onClick={() => setShowSavedPipelinesModal(true)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
            >
              <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
              <span>Saved Pipelines</span>
            </button>

            {/* Save Current Pipeline */}
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={pipeline.length === 0}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Save Pipeline</span>
            </button>

            {/* Clear All */}
            {pipeline.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}

            {/* Run Preview Button */}
            <button
              onClick={onPreview}
              disabled={pipeline.length === 0 || isLoadingPreview}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center space-x-2 transition-all shadow-md shadow-indigo-950/50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isLoadingPreview ? 'Executing Pipeline...' : 'Run & Validate Pipeline'}</span>
            </button>
          </div>
        </div>

        {/* Metrics & Health Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Total Transformations */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Steps</span>
            <div className="text-lg font-bold text-white mt-0.5">{pipeline.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {activeStepsCount} active, {disabledStepsCount} disabled
            </div>
          </div>

          {/* Validation Status */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Validation Status</span>
            <div className="mt-1 flex items-center space-x-1.5">
              {errorCount > 0 ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950 text-rose-400 border border-rose-900 flex items-center space-x-1">
                  <XCircle className="w-3 h-3" />
                  <span>{errorCount} Error{errorCount > 1 ? 's' : ''}</span>
                </span>
              ) : warningCount > 0 ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-400 border border-amber-900 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{warningCount} Warning{warningCount > 1 ? 's' : ''}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>All Steps Valid</span>
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Non-destructive</div>
          </div>

          {/* Rows Impact */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Row Count</span>
            <div className="text-lg font-bold text-white mt-0.5">
              {preview ? preview.totalCleanedRows : dataset.rowCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {preview ? `${preview.affectedRowCount} modified/filtered` : 'Pending execution'}
            </div>
          </div>

          {/* Column Count */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Columns</span>
            <div className="text-lg font-bold text-white mt-0.5">
              {preview ? preview.columns.length : dataset.columns.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {preview && preview.summary
                ? `+${preview.summary.columnsAdded} added, -${preview.summary.columnsRemoved} dropped`
                : 'Schema active'}
            </div>
          </div>

          {/* Data Quality Delta */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Quality Score</span>
            <div className="text-lg font-bold text-white mt-0.5 flex items-center space-x-1.5">
              {preview?.qualityBefore && preview?.qualityAfter ? (
                <>
                  <span className="text-slate-400">{preview.qualityBefore.overallQualityScore}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-emerald-400 font-bold">{preview.qualityAfter.overallQualityScore}</span>
                </>
              ) : (
                <span className="text-slate-400">{dataset.profile?.overallQualityScore ?? '--'}</span>
              )}
            </div>
            <div className="text-[11px] text-emerald-400/90 mt-0.5 font-medium">
              {preview?.qualityBefore && preview?.qualityAfter
                ? `${preview.qualityAfter.overallQualityScore >= preview.qualityBefore.overallQualityScore ? '+' : ''}${
                    preview.qualityAfter.overallQualityScore - preview.qualityBefore.overallQualityScore
                  } pts improvement`
                : 'Run preview to score'}
            </div>
          </div>

          {/* Execution Time */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Execution Speed</span>
            <div className="text-lg font-bold text-white mt-0.5 flex items-center space-x-1">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>{preview ? `${preview.executionTimeMs}ms` : '--'}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Deterministic replay</div>
          </div>
        </div>
      </div>

      {/* Pipeline Global Validation Errors Banner */}
      {validation.errors.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-200 text-xs space-y-2">
          <div className="flex items-center space-x-2 font-bold text-rose-400">
            <XCircle className="w-4 h-4" />
            <span>Pipeline Dependency Issues Detected ({validation.errors.length}):</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-slate-300">
            {validation.errors.map((err, idx) => (
              <li key={idx} className="font-mono text-[11px] text-rose-300">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Transformation Steps Sequence List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Sequential Execution Pipeline ({pipeline.length} steps)
          </h4>
          <span className="text-[11px] text-slate-500">
            Drag or use arrows to reorder • Toggle switch to test step isolation
          </span>
        </div>

        {pipeline.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Your Transformation Pipeline is Empty</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Select any transformation from the workspace tabs above (e.g. Column Ops, Calculated Columns, Text Cleaning, Filters) to add non-destructive rules to this pipeline.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setShowSavedPipelinesModal(true)}
                className="px-4 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold inline-flex items-center space-x-2 transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Load a Saved Pipeline Template</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pipeline.map((step, index) => {
              const stepVal = getStepValidation(step.id);
              const metric = getStepMetric(step.id);
              const isInvalid = stepVal?.status === 'invalid' || metric?.executionStatus === 'failed';
              const isWarning = stepVal?.status === 'warning';

              return (
                <div
                  key={step.id}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    !step.enabled
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                      : isInvalid
                      ? 'bg-rose-950/20 border-rose-900/80'
                      : isWarning
                      ? 'bg-amber-950/20 border-amber-900/60'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                    {/* Left: Step number, toggle switch, and description */}
                    <div className="flex items-center space-x-3.5 truncate flex-1 min-w-[300px]">
                      {/* Step Number Badge */}
                      <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono font-bold text-indigo-300 flex-shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      {/* Enable/Disable Toggle Switch */}
                      <button
                        onClick={() => onToggleStep(step.id)}
                        className={`w-9 h-5 flex items-center rounded-full p-1 transition-colors flex-shrink-0 ${
                          step.enabled ? 'bg-indigo-600' : 'bg-slate-700'
                        }`}
                        title={step.enabled ? 'Click to disable step' : 'Click to enable step'}
                      >
                        <div
                          className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                            step.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* Step Details & Badges */}
                      <div className="truncate flex-1">
                        <div className="flex items-center space-x-2 truncate">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-indigo-950 text-indigo-300 border border-indigo-900 flex-shrink-0">
                            {step.type.replace(/_/g, ' ')}
                          </span>

                          {step.column && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300 flex-shrink-0">
                              {step.column}
                            </span>
                          )}

                          {step.isAiRecommended && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/60 flex items-center space-x-1 flex-shrink-0">
                              <Sparkles className="w-3 h-3 text-purple-400" />
                              <span>AI Recommended</span>
                            </span>
                          )}

                          <span className="text-xs font-medium text-white truncate">
                            {step.description}
                          </span>
                        </div>

                        {/* Step Execution Metric Sub-bar */}
                        {metric && step.enabled && (
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                            {metric.rowsRemoved > 0 && (
                              <span className="text-rose-400">-{metric.rowsRemoved} rows</span>
                            )}
                            {metric.rowsModified > 0 && (
                              <span className="text-indigo-300">{metric.rowsModified} rows modified</span>
                            )}
                            {metric.columnsAdded.length > 0 && (
                              <span className="text-emerald-400">+{metric.columnsAdded.join(', ')}</span>
                            )}
                            {metric.columnsRemoved.length > 0 && (
                              <span className="text-rose-400">-{metric.columnsRemoved.join(', ')}</span>
                            )}
                            {metric.durationMs !== undefined && (
                              <span className="text-slate-500">{metric.durationMs}ms</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle: Step Validation Badge */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {!step.enabled ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                          Disabled
                        </span>
                      ) : isInvalid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-900 flex items-center space-x-1">
                          <XCircle className="w-3 h-3" />
                          <span>Invalid</span>
                        </span>
                      ) : isWarning ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-900 flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Warning</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Valid</span>
                        </span>
                      )}
                    </div>

                    {/* Right: Step Actions Controls */}
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {/* Edit */}
                      <button
                        onClick={() => setEditingStepIndex(index)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit Step Parameters"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={() => onDuplicateStep(index)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Duplicate Step"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {/* Move Up */}
                      <button
                        onClick={() => onMoveStep(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      {/* Move Down */}
                      <button
                        onClick={() => onMoveStep(index, 'down')}
                        disabled={index === pipeline.length - 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => onRemoveStep(step.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        title="Delete Step"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Warning / Error Diagnostic Message with Quick Fix actions */}
                  {(isInvalid || isWarning) && step.enabled && (
                    <div
                      className={`px-4 py-2 text-xs border-t flex flex-wrap items-center justify-between gap-2 ${
                        isInvalid
                          ? 'bg-rose-950/60 border-rose-900/60 text-rose-300'
                          : 'bg-amber-950/60 border-amber-900/60 text-amber-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {isInvalid ? (
                          <XCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                        )}
                        <span>{stepVal?.message || metric?.error || 'Validation error encountered.'}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingStepIndex(index)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold border border-slate-700 transition-colors"
                        >
                          Edit Step
                        </button>
                        <button
                          onClick={() => onToggleStep(step.id)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-700 transition-colors"
                        >
                          Disable Step
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear All Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Clear Entire Pipeline?</h3>
            </div>
            <p className="text-xs text-slate-300">
              This will remove all <span className="font-bold text-white">{pipeline.length}</span> transformation steps from the active workspace. This action can be reversed with Undo.
            </p>
            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearAll();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Yes, Clear All Steps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step Edit Modal */}
      {editingStepIndex !== null && pipeline[editingStepIndex] && (
        <StepEditModal
          step={pipeline[editingStepIndex]}
          columns={dataset.columns}
          onSave={updated => {
            onEditStep(editingStepIndex, updated);
            setEditingStepIndex(null);
          }}
          onClose={() => setEditingStepIndex(null)}
        />
      )}

      {/* Save Pipeline Modal */}
      {showSaveModal && (
        <SavePipelineModal
          currentPipeline={pipeline}
          sourceDatasetId={dataset.datasetId}
          sourceDatasetName={dataset.name}
          activeSavedPipeline={activeSavedPipeline}
          onSaved={saved => {
            setActiveSavedPipeline(saved);
          }}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* Saved Pipelines Management & Loading Modal */}
      {showSavedPipelinesModal && (
        <SavedPipelinesModal
          currentDataset={dataset}
          onApplyPipeline={handleApplySavedPipeline}
          onClose={() => setShowSavedPipelinesModal(false)}
        />
      )}
    </div>
  );
};
