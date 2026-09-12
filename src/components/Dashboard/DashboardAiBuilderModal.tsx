import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  X,
  Check,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  BarChart3,
  PieChart,
  Table as TableIcon,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { DatabaseApiClient } from '../../services/databaseApi';
import { Dashboard, DashboardWidget } from '../../types/dashboard';

interface DashboardAiBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPlan: (dashboard: Dashboard) => void;
  isConnected: boolean;
}

export const DashboardAiBuilderModal: React.FC<DashboardAiBuilderModalProps> = ({
  isOpen,
  onClose,
  onApplyPlan,
  isConnected
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<{
    dashboardTitle: string;
    dashboardDescription: string;
    widgets: any[];
    warnings: string[];
  } | null>(null);
  const [selectedWidgetIndices, setSelectedWidgetIndices] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedPlan(null);

    try {
      const plan = await DatabaseApiClient.generateDashboardWithAi(prompt.trim());
      setGeneratedPlan(plan);
      // Select all widgets by default
      const allIndices = new Set<number>(plan.widgets.map((_, i) => i));
      setSelectedWidgetIndices(allIndices);
    } catch (err: any) {
      setError(err.message || 'Failed to generate dashboard plan with AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleWidgetIndex = (idx: number) => {
    setSelectedWidgetIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleCreateDashboard = () => {
    if (!generatedPlan) return;

    const chosenWidgets: DashboardWidget[] = generatedPlan.widgets
      .filter((_, idx) => selectedWidgetIndices.has(idx))
      .map((w, idx) => ({
        id: `widget-ai-${Date.now()}-${idx}`,
        title: w.title,
        description: w.description,
        chartType: w.chartType,
        size: {
          colSpan: w.colSpan || 6,
          height: w.height || 300
        },
        position: {
          order: idx,
          col: 0,
          row: idx
        },
        queryRef: {
          type: 'raw_sql',
          sql: w.sql,
          sourceTable: w.sourceTable,
          referencedTables: w.sourceTable ? [w.sourceTable] : []
        },
        chartConfig: {
          chartType: w.chartType,
          title: w.title,
          subtitle: w.description,
          xAxis: '',
          yAxis: '',
          secondaryMeasures: [],
          aggregation: 'none',
          sortOrder: 'none',
          sortBy: 'x',
          limit: 'all',
          showLegend: true,
          showDataLabels: false,
          showGrid: true,
          binCount: 10,
          treatNullAsZero: true
        },
        status: 'idle'
      }));

    const now = new Date().toISOString();
    const newDashboard: Dashboard = {
      id: `dash-ai-${Date.now()}`,
      name: generatedPlan.dashboardTitle || 'AI-Generated Dashboard',
      description: generatedPlan.dashboardDescription || prompt,
      widgets: chosenWidgets,
      filters: [],
      layout: {
        columns: 12,
        gap: 'md',
        theme: 'dark'
      },
      createdAt: now,
      updatedAt: now,
      permissions: { role: 'owner' },
      autoRefreshInterval: 0
    };

    onApplyPlan(newDashboard);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Build Dashboard with AI</h3>
              <p className="text-xs text-slate-400">
                Grounds all suggested widgets strictly in your live database schema
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {!isConnected && (
            <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-xl text-xs text-amber-200 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Please connect a database first. The AI dashboard builder requires active schema metadata to construct grounded queries.
              </span>
            </div>
          )}

          {/* Prompt Form */}
          <form onSubmit={handleGenerate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                What would you like this dashboard to track?
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g. Create a sales dashboard showing monthly revenue trends, top customer spend, regional order counts, and overall average order value..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero hallucinated tables • Strictly read-only queries</span>
              </div>
              <button
                type="submit"
                disabled={!prompt.trim() || isGenerating || !isConnected}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-purple-950"
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>Analyzing Schema & Planning...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Proposal</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Generated Plan Review */}
          {generatedPlan && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 animate-in fade-in">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-white">
                  {generatedPlan.dashboardTitle}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {generatedPlan.dashboardDescription}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Proposed Widgets ({generatedPlan.widgets.length}) — Review & select:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {selectedWidgetIndices.size} selected
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {generatedPlan.widgets.map((widget, idx) => {
                    const isSelected = selectedWidgetIndices.has(idx);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleWidgetIndex(idx)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-purple-950/20 border-purple-500/50 text-slate-200'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleWidgetIndex(idx)}
                              className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                              <div className="flex items-center space-x-2">
                                <h5 className="text-xs font-semibold text-slate-100">
                                  {widget.title}
                                </h5>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-mono">
                                  {widget.chartType}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {widget.description}
                              </p>
                              <p className="text-[10px] font-mono text-indigo-300 mt-1 truncate max-w-md">
                                {widget.sql}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {generatedPlan && (
            <button
              type="button"
              onClick={handleCreateDashboard}
              disabled={selectedWidgetIndices.size === 0}
              className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shadow-lg shadow-emerald-950"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Create Dashboard ({selectedWidgetIndices.size} widgets)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
