import React from 'react';
import { Layers, ArrowUp, ArrowDown, Trash2, CheckCircle2, XCircle, RotateCcw, Play } from 'lucide-react';
import { TransformStep } from '../../../types/cleaning';

interface PipelineTabProps {
  pipeline: TransformStep[];
  onToggleStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onMoveStep: (index: number, direction: 'up' | 'down') => void;
  onClearAll: () => void;
  onPreview: () => void;
  isLoadingPreview?: boolean;
}

export const PipelineTab: React.FC<PipelineTabProps> = ({
  pipeline,
  onToggleStep,
  onRemoveStep,
  onMoveStep,
  onClearAll,
  onPreview,
  isLoadingPreview
}) => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header & Controls */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">
            Transformation Pipeline Sequence ({pipeline.length} steps)
          </h3>
        </div>

        <div className="flex items-center space-x-2">
          {pipeline.length > 0 && (
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-300 text-xs font-medium flex items-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Pipeline</span>
            </button>
          )}

          <button
            onClick={onPreview}
            disabled={pipeline.length === 0 || isLoadingPreview}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isLoadingPreview ? 'Computing Preview...' : 'Run Preview on Dataset'}</span>
          </button>
        </div>
      </div>

      {/* Step Sequence List */}
      {pipeline.length === 0 ? (
        <div className="p-12 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-300">Transformation Pipeline is Empty</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Add cleaning rules from any of the tabs above (Missing Values, Duplicates, Types, Dates, Text, Outliers) to build your step-by-step reproducible pipeline.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pipeline.map((step, index) => (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                step.enabled
                  ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-white'
                  : 'bg-slate-950/40 border-slate-800/50 opacity-60 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-3 truncate">
                {/* Step badge */}
                <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono font-bold text-indigo-300 flex-shrink-0">
                  {index + 1}
                </span>

                {/* Status toggle checkbox */}
                <button
                  onClick={() => onToggleStep(step.id)}
                  title={step.enabled ? 'Click to disable' : 'Click to enable'}
                  className="flex-shrink-0"
                >
                  {step.enabled ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-600" />
                  )}
                </button>

                {/* Operation details */}
                <div className="truncate">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-900/50">
                      {step.type}
                    </span>
                    {step.column && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300">
                        {step.column}
                      </span>
                    )}
                    <span className="text-xs text-slate-200 font-medium truncate">{step.description}</span>
                  </div>
                </div>
              </div>

              {/* Reordering & Deletion Actions */}
              <div className="flex items-center space-x-1 flex-shrink-0 ml-3">
                <button
                  onClick={() => onMoveStep(index, 'up')}
                  disabled={index === 0}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onMoveStep(index, 'down')}
                  disabled={index === pipeline.length - 1}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRemoveStep(step.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                  title="Remove Step"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
