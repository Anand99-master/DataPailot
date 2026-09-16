import React, { useState } from 'react';
import { X, BookmarkPlus, Layers, CheckCircle2, History, Database } from 'lucide-react';
import { TransformStep, SavedPipeline } from '../../../types/cleaning';
import { PipelineValidator } from '../../../utils/pipelineValidator';
import { PipelineStorage } from '../../../utils/pipelineStorage';
import { CollaborationApiClient } from '../../../services/collaborationApi';

interface SavePipelineModalProps {
  currentPipeline: TransformStep[];
  sourceDatasetId?: string;
  sourceDatasetName?: string;
  activeSavedPipeline?: SavedPipeline | null;
  onSaved: (pipeline: SavedPipeline) => void;
  onClose: () => void;
}

export const SavePipelineModal: React.FC<SavePipelineModalProps> = ({
  currentPipeline,
  sourceDatasetId,
  sourceDatasetName,
  activeSavedPipeline,
  onSaved,
  onClose
}) => {
  const [name, setName] = useState(activeSavedPipeline?.name || `${sourceDatasetName || 'Dataset'} Cleaning Pipeline`);
  const [description, setDescription] = useState(activeSavedPipeline?.description || '');
  const [createNewVersion, setCreateNewVersion] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requiredCols = PipelineValidator.extractRequiredColumns(currentPipeline);
  const isEditingExisting = !!activeSavedPipeline;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a pipeline name.');
      return;
    }

    try {
      const saved = PipelineStorage.savePipeline(name, currentPipeline, {
        id: isEditingExisting ? activeSavedPipeline.id : undefined,
        description,
        sourceDatasetId,
        sourceDatasetName,
        createNewVersion: isEditingExisting ? createNewVersion : false
      });

      CollaborationApiClient.savePipeline({
        id: saved.id,
        name: saved.name,
        description: saved.description,
        steps: saved.steps,
        datasetId: sourceDatasetId
      }).catch(() => {});

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save pipeline.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookmarkPlus className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">
              {isEditingExisting ? 'Update Saved Pipeline' : 'Save Transformation Pipeline'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-900 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Pipeline Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500"
              placeholder="e.g. Monthly Sales Standardization"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500"
              placeholder="Describe the objective or transformations in this pipeline..."
            />
          </div>

          {/* Pipeline Summary Info Card */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Steps:</span>
              <span className="font-semibold text-white">{currentPipeline.length} ({currentPipeline.filter(s => s.enabled).length} enabled)</span>
            </div>
            {sourceDatasetName && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Source Dataset:</span>
                <span className="font-mono text-indigo-300 truncate max-w-[200px]">{sourceDatasetName}</span>
              </div>
            )}
            <div className="text-xs pt-2 border-t border-slate-800/80">
              <span className="text-slate-400 block mb-1.5">Required Columns ({requiredCols.length}):</span>
              {requiredCols.length === 0 ? (
                <span className="text-slate-500 italic">No specific columns required (global operations).</span>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {requiredCols.map(c => (
                    <span key={c} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Versioning Option if updating */}
          {isEditingExisting && (
            <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-indigo-400" />
                <div>
                  <p className="text-xs font-semibold text-white">
                    Create New Version Snapshot (v{(activeSavedPipeline.version || 1) + 1})
                  </p>
                  <p className="text-[11px] text-slate-400">Preserves version history to allow rollbacks.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={createNewVersion}
                onChange={e => setCreateNewVersion(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditingExisting ? 'Update Pipeline' : 'Save Pipeline'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
