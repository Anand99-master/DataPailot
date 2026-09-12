import React, { useState } from 'react';
import { Bookmark, Trash2, Calendar, BarChart2, X, ExternalLink, Download } from 'lucide-react';
import { SavedVisualization, ChartConfig } from '../../types/visualization';

interface SavedVisualizationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedList: SavedVisualization[];
  onLoadVisualization: (saved: SavedVisualization) => void;
  onDeleteVisualization: (id: string) => void;
}

export const SavedVisualizationsModal: React.FC<SavedVisualizationsModalProps> = ({
  isOpen,
  onClose,
  savedList,
  onLoadVisualization,
  onDeleteVisualization
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2 text-slate-100 font-semibold text-sm">
            <Bookmark className="w-4 h-4 text-indigo-400" />
            <span>Saved Visualizations ({savedList.length})</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {savedList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No saved visualizations yet. Click "Save Visualization" while viewing a chart to bookmark it.
            </div>
          ) : (
            savedList.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-slate-100">{item.name}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {item.chartType}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-slate-400">
                    <span>X: {item.config.xAxis || 'N/A'}</span>
                    <span>Y: {item.config.yAxis || 'N/A'}</span>
                    <span className="flex items-center space-x-1 text-[11px] text-slate-400">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      onLoadVisualization(item);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center space-x-1"
                  >
                    <span>Load</span>
                  </button>

                  <button
                    onClick={() => onDeleteVisualization(item.id)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
                    title="Delete saved chart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
