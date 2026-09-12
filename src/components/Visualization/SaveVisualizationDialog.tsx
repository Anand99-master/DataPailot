import React, { useState } from 'react';
import { Bookmark, X } from 'lucide-react';
import { ChartConfig } from '../../types/visualization';

interface SaveVisualizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  config: ChartConfig;
  onSave: (name: string) => void;
}

export const SaveVisualizationDialog: React.FC<SaveVisualizationDialogProps> = ({
  isOpen,
  onClose,
  config,
  onSave
}) => {
  const [name, setName] = useState(config.title || 'My Visualization');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2 text-slate-100 font-semibold text-sm">
            <Bookmark className="w-4 h-4 text-indigo-400" />
            <span>Save Visualization</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Visualization Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Monthly Revenue Breakdown"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
              autoFocus
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-mono text-slate-200 uppercase">{config.chartType}</span>
            </div>
            <div className="flex justify-between">
              <span>X Axis:</span>
              <span className="font-mono text-slate-200">{config.xAxis || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Y Axis:</span>
              <span className="font-mono text-slate-200">{config.yAxis || 'N/A'}</span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-sm"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
