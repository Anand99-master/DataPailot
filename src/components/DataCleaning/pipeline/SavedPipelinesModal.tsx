import React, { useState, useEffect } from 'react';
import {
  X,
  Bookmark,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Edit2,
  Trash2,
  History,
  ArrowRight,
  Database,
  Calendar,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { SavedPipeline, DatasetCompatibilityResult, TransformStep } from '../../../types/cleaning';
import { ImportedDataset } from '../../../types/import';
import { PipelineStorage } from '../../../utils/pipelineStorage';
import { PipelineValidator } from '../../../utils/pipelineValidator';
import { VersionHistoryModal } from './VersionHistoryModal';
import { useCollaboration } from '../../../context/CollaborationContext';
import { CollaborationApiClient } from '../../../services/collaborationApi';

interface SavedPipelinesModalProps {
  currentDataset: ImportedDataset;
  onApplyPipeline: (steps: TransformStep[], savedPipeline: SavedPipeline, mode: 'replace' | 'append') => void;
  onClose: () => void;
}

export const SavedPipelinesModal: React.FC<SavedPipelinesModalProps> = ({
  currentDataset,
  onApplyPipeline,
  onClose
}) => {
  const { activeWorkspace, activeProjectId } = useCollaboration();
  const [savedPipelines, setSavedPipelines] = useState<SavedPipeline[]>(() => {
    PipelineStorage.setWorkspaceId(activeWorkspace?.id || 'ws_primary');
    PipelineStorage.setProjectId(activeProjectId);
    return PipelineStorage.getSavedPipelines();
  });
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
    savedPipelines.length > 0 ? savedPipelines[0].id : null
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [historyPipeline, setHistoryPipeline] = useState<SavedPipeline | null>(null);
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');

  useEffect(() => {
    PipelineStorage.setWorkspaceId(activeWorkspace?.id || 'ws_primary');
    PipelineStorage.setProjectId(activeProjectId);
    const list = PipelineStorage.getSavedPipelines();
    setSavedPipelines(list);
    setSelectedPipelineId(list.length > 0 ? list[0].id : null);

    CollaborationApiClient.listPipelines(activeProjectId || undefined)
      .then(res => {
        if (res && res.success && Array.isArray(res.pipelines)) {
          const local = PipelineStorage.getSavedPipelines();
          const map = new Map<string, SavedPipeline>();
          local.forEach(p => map.set(p.id, p));
          res.pipelines.forEach(p => {
            const mapped: SavedPipeline = {
              id: p.id,
              name: p.name,
              description: p.description,
              steps: p.steps || [],
              sourceDatasetId: p.datasetId,
              sourceDatasetName: '',
              requiredColumns: p.requiredColumns || [],
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
              version: 1,
              projectId: p.projectId
            };
            map.set(p.id, mapped);
          });
          const merged = Array.from(map.values());
          setSavedPipelines(merged);
        }
      })
      .catch(() => {});
  }, [activeWorkspace?.id, activeProjectId]);

  const selectedPipeline = savedPipelines.find(p => p.id === selectedPipelineId) || null;

  // Compatibility check of selected pipeline against current dataset
  const compatibility: DatasetCompatibilityResult | null = selectedPipeline
    ? PipelineValidator.checkCompatibility(selectedPipeline, currentDataset.columns)
    : null;

  const handleDuplicate = (id: string) => {
    const copy = PipelineStorage.duplicatePipeline(id);
    if (copy) {
      setSavedPipelines(PipelineStorage.getSavedPipelines());
      setSelectedPipelineId(copy.id);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this saved pipeline?')) {
      PipelineStorage.deletePipeline(id);
      const updated = PipelineStorage.getSavedPipelines();
      setSavedPipelines(updated);
      if (selectedPipelineId === id) {
        setSelectedPipelineId(updated.length > 0 ? updated[0].id : null);
      }
    }
  };

  const handleStartRename = (pipeline: SavedPipeline) => {
    setEditingId(pipeline.id);
    setEditingName(pipeline.name);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      PipelineStorage.renamePipeline(id, editingName.trim());
      setSavedPipelines(PipelineStorage.getSavedPipelines());
    }
    setEditingId(null);
  };

  const handleApply = () => {
    if (!selectedPipeline) return;
    onApplyPipeline(selectedPipeline.steps, selectedPipeline, applyMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Bookmark className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-semibold text-white">Saved Transformation Pipelines</h3>
              <p className="text-xs text-slate-400">
                Apply standardized cleaning sequences to{' '}
                <span className="text-indigo-300 font-mono font-semibold">{currentDataset.name}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Split 2-pane view) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-hidden">
          {/* Left: Saved Pipelines List (5 cols) */}
          <div className="md:col-span-5 p-4 overflow-y-auto space-y-2 bg-slate-950/40">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Available Pipelines ({savedPipelines.length})
            </p>

            {savedPipelines.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No saved pipelines found. You can save your current pipeline from the main workspace.
              </div>
            ) : (
              savedPipelines.map(pipe => {
                const isSelected = pipe.id === selectedPipelineId;
                const pipeCompat = PipelineValidator.checkCompatibility(pipe, currentDataset.columns);

                return (
                  <div
                    key={pipe.id}
                    onClick={() => setSelectedPipelineId(pipe.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500/60 text-white'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {editingId === pipe.id ? (
                        <div className="flex items-center space-x-1 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveRename(pipe.id)}
                            className="px-2 py-0.5 rounded bg-slate-950 border border-indigo-500 text-xs text-white w-full"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(pipe.id)}
                            className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px]"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <h4 className="font-semibold text-xs text-white truncate max-w-[180px]">{pipe.name}</h4>
                      )}

                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                        v{pipe.version || 1}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-indigo-400" />
                        <span>{pipe.steps.length} steps</span>
                      </div>

                      {/* Compatibility Badge */}
                      {pipeCompat.status === 'fully_compatible' ? (
                        <span className="text-emerald-400 flex items-center space-x-1 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Compatible</span>
                        </span>
                      ) : pipeCompat.status === 'partially_compatible' ? (
                        <span className="text-amber-400 flex items-center space-x-1 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Partial Match</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center space-x-1 font-medium">
                          <XCircle className="w-3 h-3" />
                          <span>Incompatible</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Pipeline Details & Compatibility Inspector (7 cols) */}
          <div className="md:col-span-7 p-6 overflow-y-auto flex flex-col justify-between">
            {selectedPipeline ? (
              <div className="space-y-4">
                {/* Pipeline Title & Action toolbar */}
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{selectedPipeline.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedPipeline.description || 'No description provided.'}</p>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-1">
                      <span>Version: v{selectedPipeline.version || 1}</span>
                      <span>Updated: {new Date(selectedPipeline.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setHistoryPipeline(selectedPipeline)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Version History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStartRename(selectedPipeline)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Rename Pipeline"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(selectedPipeline.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Duplicate Pipeline"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(selectedPipeline.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300"
                      title="Delete Pipeline"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Compatibility Assessment Box */}
                {compatibility && (
                  <div
                    className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                      compatibility.status === 'fully_compatible'
                        ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-200'
                        : compatibility.status === 'partially_compatible'
                        ? 'bg-amber-950/40 border-amber-900/60 text-amber-200'
                        : 'bg-rose-950/40 border-rose-900/60 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <div className="flex items-center space-x-2">
                        {compatibility.status === 'fully_compatible' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : compatibility.status === 'partially_compatible' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span>
                          {compatibility.status === 'fully_compatible'
                            ? 'Dataset Fully Compatible'
                            : compatibility.status === 'partially_compatible'
                            ? 'Dataset Partially Compatible'
                            : 'Dataset Incompatible'}
                        </span>
                      </div>
                      <span className="text-[11px] opacity-80">
                        {compatibility.matchedColumns.length} matched / {selectedPipeline.requiredColumns.length} required
                      </span>
                    </div>

                    {compatibility.missingColumns.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-medium opacity-90">Missing Columns in target dataset:</p>
                        <div className="flex flex-wrap gap-1">
                          {compatibility.missingColumns.map(m => (
                            <span key={m} className="px-2 py-0.5 rounded text-[10px] font-mono bg-black/40 text-rose-300 border border-rose-800/50">
                              {m}
                            </span>
                          ))}
                        </div>

                        {compatibility.possibleMatches.length > 0 && (
                          <div className="mt-2 p-2 rounded-lg bg-black/30 text-[11px] space-y-1">
                            <span className="font-semibold text-amber-300">Suggested Candidate Matches:</span>
                            {compatibility.possibleMatches.map(pm => (
                              <div key={pm.missing} className="flex items-center space-x-2 font-mono text-[10px]">
                                <span className="text-slate-400">{pm.missing}</span>
                                <ArrowRight className="w-3 h-3 text-amber-400" />
                                <span className="text-amber-200">{pm.candidate}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Steps Sequence Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>Transformation Sequence ({selectedPipeline.steps.length} steps):</span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedPipeline.steps.map((st, i) => (
                      <div
                        key={st.id || i}
                        className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 flex items-center justify-center font-mono text-[10px]">
                            {i + 1}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-900">
                            {st.type}
                          </span>
                          <span className="text-slate-300 truncate">{st.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Application Options & Apply Button */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 text-xs">
                    <label className="flex items-center space-x-1.5 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="applyMode"
                        checked={applyMode === 'replace'}
                        onChange={() => setApplyMode('replace')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Replace Active Pipeline</span>
                    </label>
                    <label className="flex items-center space-x-1.5 text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="applyMode"
                        checked={applyMode === 'append'}
                        onChange={() => setApplyMode('append')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Append to Active</span>
                    </label>
                  </div>

                  <button
                    onClick={handleApply}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply Pipeline to Dataset</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                Select a pipeline to view details and compatibility.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Version History Sub-modal */}
      {historyPipeline && (
        <VersionHistoryModal
          pipeline={historyPipeline}
          onRestore={restored => {
            setSavedPipelines(PipelineStorage.getSavedPipelines());
            setSelectedPipelineId(restored.id);
            setHistoryPipeline(null);
          }}
          onClose={() => setHistoryPipeline(null)}
        />
      )}
    </div>
  );
};
