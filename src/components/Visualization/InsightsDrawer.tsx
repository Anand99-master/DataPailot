import React from 'react';
import { Sparkles, TrendingUp, AlertTriangle, BarChart3, CheckCircle2, X } from 'lucide-react';
import { VisualizationInsight } from '../../types/visualization';

interface InsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  insights: VisualizationInsight[];
  isLoading: boolean;
  onRegenerate: () => void;
}

export const InsightsDrawer: React.FC<InsightsDrawerProps> = ({
  isOpen,
  onClose,
  insights,
  isLoading,
  onRegenerate
}) => {
  if (!isOpen) return null;

  return (
    <div id="insights-panel" className="w-80 flex flex-col h-full bg-slate-900 border-l border-slate-800 text-xs overflow-hidden z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-2 font-semibold text-slate-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Factual Insights</span>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Subheader note */}
      <div className="px-4 py-2 bg-slate-950/20 border-b border-slate-800/60 text-[11px] text-slate-400">
        Strictly grounded in returned data. No speculative numbers or hallucinations.
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-slate-400">
            <Sparkles className="w-6 h-6 text-emerald-400 animate-spin" />
            <span className="text-xs">Deriving mathematical findings...</span>
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            Click "Generate Insights" to derive key takeaways.
          </div>
        ) : (
          insights.map((item, idx) => {
            let Icon = BarChart3;
            let iconColor = 'text-indigo-400';
            let bgBorder = 'border-slate-800 bg-slate-950/60';

            if (item.type === 'trend') {
              Icon = TrendingUp;
              iconColor = 'text-emerald-400';
            } else if (item.type === 'extreme') {
              Icon = CheckCircle2;
              iconColor = 'text-amber-400';
            } else if (item.type === 'distribution') {
              Icon = BarChart3;
              iconColor = 'text-cyan-400';
            }

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border ${bgBorder} space-y-1.5 shadow-sm transition-all`}
              >
                <div className="flex items-center space-x-2 font-semibold text-slate-200">
                  <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                  <span>{item.title}</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">{item.text}</p>
                {item.evidence && (
                  <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-850">
                    Evidence: {item.evidence}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <button
          onClick={onRegenerate}
          disabled={isLoading}
          className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Refresh Insights</span>
        </button>
      </div>
    </div>
  );
};
