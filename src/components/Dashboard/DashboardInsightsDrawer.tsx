import React from 'react';
import {
  Sparkles,
  X,
  TrendingUp,
  AlertCircle,
  BarChart,
  CheckCircle2,
  Database
} from 'lucide-react';
import { DashboardInsightItem } from '../../types/dashboard';

interface DashboardInsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  insights: DashboardInsightItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const DashboardInsightsDrawer: React.FC<DashboardInsightsDrawerProps> = ({
  isOpen,
  onClose,
  insights,
  isLoading,
  onRefresh
}) => {
  if (!isOpen) return null;

  const getTypeBadge = (type: DashboardInsightItem['type']) => {
    switch (type) {
      case 'trend':
        return (
          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <TrendingUp className="w-3 h-3" />
            <span>Trend</span>
          </span>
        );
      case 'outlier':
        return (
          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertCircle className="w-3 h-3" />
            <span>Outlier</span>
          </span>
        );
      case 'benchmark':
        return (
          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <BarChart className="w-3 h-3" />
            <span>Benchmark</span>
          </span>
        );
      case 'metric':
      default:
        return (
          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>Metric</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Dashboard Insights</h3>
            <p className="text-[11px] text-slate-400">Factual cross-widget observations</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2 text-slate-400 text-center">
            <div className="w-7 h-7 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <p className="text-xs font-medium text-slate-300">Deriving factual insights...</p>
            <p className="text-[11px] text-slate-400">Evaluating displayed values across widgets</p>
          </div>
        ) : insights.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Database className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-300">No insights available</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Ensure widgets have successfully executed queries, then click Generate Insights.
            </p>
          </div>
        ) : (
          insights.map(item => (
            <div
              key={item.id}
              className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-100">{item.title}</h4>
                {getTypeBadge(item.type)}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{item.text}</p>
              {item.widgetSourceTitle && (
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Source: {item.widgetSourceTitle}</span>
                  {item.evidence && <span className="font-mono text-indigo-300">{item.evidence}</span>}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          Strictly grounded • Zero invented numbers
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Regenerate</span>
        </button>
      </div>
    </div>
  );
};
