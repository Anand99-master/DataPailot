import React, { useState } from 'react';
import { X, History, RotateCcw, CheckCircle2, ChevronRight, Layers, Calendar } from 'lucide-react';
import { SavedPipeline, PipelineVersionSnapshot } from '../../../types/cleaning';
import { PipelineStorage } from '../../../utils/pipelineStorage';

interface VersionHistoryModalProps {
  pipeline: SavedPipeline;
  onRestore: (restoredPipeline: SavedPipeline) => void;
  onClose: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  pipeline,
  onRestore,
  onClose
}) => {
  const versions: PipelineVersionSnapshot[] = pipeline.versions && pipeline.versions.length > 0
    ? pipeline.versions
    : [
        {
          version: pipeline.version || 1,
          name: pipeline.name,
          description: pipeline.description,
          steps: pipeline.steps,
          updatedAt: pipeline.updatedAt
        }
      ];

  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(pipeline.version || 1);
  const selectedSnapshot = versions.find(v => v.version === selectedVersionNum) || versions[versions.length - 1];

  const handleRestore = (verNum: number) => {
    const res = PipelineStorage.restoreVersion(pipeline.id, verNum);
    if (res) {
      onRestore(res);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-semibold text-white">Pipeline Version History</h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{pipeline.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (2 columns: version list on left, details on right) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-hidden">
          {/* Left: Version List */}
          <div className="p-4 overflow-y-auto space-y-2 bg-slate-950/50">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Versions</p>
            {versions.slice().reverse().map(v => {
              const isSelected = v.version === selectedVersionNum;
              const isCurrent = v.version === pipeline.version;

              return (
                <button
                  key={v.version}
                  onClick={() => setSelectedVersionNum(v.version)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500/50 text-white'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">v{v.version}</span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-1">
                    <Layers className="w-3 h-3" />
                    <span>{v.steps.length} steps</span>
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-500 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(v.updatedAt).toLocaleDateString()} {new Date(v.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Version Steps Details */}
          <div className="md:col-span-2 p-6 overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Version {selectedSnapshot.version} Details
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Saved on {new Date(selectedSnapshot.updatedAt).toLocaleString()}
                  </p>
                </div>
                {selectedSnapshot.version !== pipeline.version && (
                  <button
                    onClick={() => handleRestore(selectedSnapshot.version)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Version</span>
                  </button>
                )}
              </div>

              {selectedSnapshot.description && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 mb-4">
                  {selectedSnapshot.description}
                </div>
              )}

              {/* Steps List */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-300">Transformation Steps ({selectedSnapshot.steps.length}):</p>
                {selectedSnapshot.steps.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No steps recorded in this version snapshot.</p>
                ) : (
                  selectedSnapshot.steps.map((st, idx) => (
                    <div
                      key={st.id || idx}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 flex items-center justify-center font-mono text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-900">
                          {st.type}
                        </span>
                        <span className="text-slate-200 truncate">{st.description}</span>
                      </div>
                      <span className={`text-[10px] ${st.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {st.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
