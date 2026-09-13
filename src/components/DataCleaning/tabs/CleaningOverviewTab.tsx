import React from 'react';
import { Sparkles, ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2, Wand2, Layers, RefreshCw, Activity, ArrowUpRight } from 'lucide-react';
import { ImportedDataset, DataProfile } from '../../../types/import';
import { TransformStep, CleaningPreviewResult } from '../../../types/cleaning';

interface CleaningOverviewTabProps {
  dataset: ImportedDataset;
  pipeline: TransformStep[];
  preview: CleaningPreviewResult | null;
  onAddQuickStep: (step: TransformStep) => void;
  onNavigateTab: (tab: any) => void;
}

export const CleaningOverviewTab: React.FC<CleaningOverviewTabProps> = ({
  dataset,
  pipeline,
  preview,
  onAddQuickStep,
  onNavigateTab
}) => {
  const profile = dataset.profile;
  const beforeScore = profile?.overallQualityScore ?? 75;
  const afterScore = preview?.qualityAfter?.overallQualityScore ?? beforeScore;
  const scoreDelta = afterScore - beforeScore;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30';
    if (score >= 75) return 'text-blue-400 border-blue-500/40 bg-blue-950/30';
    if (score >= 60) return 'text-amber-400 border-amber-500/40 bg-amber-950/30';
    return 'text-rose-400 border-rose-500/40 bg-rose-950/30';
  };

  const getScoreCategory = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Poor';
  };

  // Quick auto-cleaning recommendations
  const recommendations: {
    id: string;
    title: string;
    desc: string;
    impact: string;
    tab: string;
    step: () => TransformStep;
  }[] = [];

  if (profile?.duplicateRowCount && profile.duplicateRowCount > 0) {
    recommendations.push({
      id: 'rec_duplicates',
      title: 'Remove Duplicate Rows',
      desc: `Found ${profile.duplicateRowCount} duplicate rows in dataset.`,
      impact: 'High',
      tab: 'duplicates',
      step: () => ({
        id: `step_${Date.now()}_dup`,
        type: 'REMOVE_DUPLICATES',
        description: 'Remove exact duplicate rows (keep first)',
        params: { columns: [], keep: 'first' },
        enabled: true,
        createdAt: new Date().toISOString()
      })
    });
  }

  // Check for whitespace strings or high missing
  if (profile?.columns) {
    for (const [colName, col] of Object.entries(profile.columns)) {
      if (col.whitespaceCount && col.whitespaceCount > 0) {
        recommendations.push({
          id: `rec_ws_${colName}`,
          title: `Trim whitespace in "${colName}"`,
          desc: `${col.whitespaceCount} whitespace-only or untrimmed strings detected.`,
          impact: 'Medium',
          tab: 'text',
          step: () => ({
            id: `step_${Date.now()}_trim_${colName}`,
            type: 'TEXT_CLEAN',
            column: colName,
            description: `Trim whitespace in "${colName}"`,
            params: { column: colName, trim: true, collapseSpaces: true, caseTransform: 'none' },
            enabled: true,
            createdAt: new Date().toISOString()
          })
        });
      }

      if (col.outlierCount && col.outlierCount > 0 && (col.dataType === 'integer' || col.dataType === 'numeric')) {
        recommendations.push({
          id: `rec_outlier_${colName}`,
          title: `Cap statistical outliers in "${colName}"`,
          desc: `${col.outlierCount} outliers detected (1.5x IQR).`,
          impact: 'Medium',
          tab: 'outliers',
          step: () => ({
            id: `step_${Date.now()}_outlier_${colName}`,
            type: 'HANDLE_OUTLIERS',
            column: colName,
            description: `Cap outliers (1.5x IQR) in "${colName}"`,
            params: { column: colName, method: 'iqr', action: 'cap', threshold: 1.5 },
            enabled: true,
            createdAt: new Date().toISOString()
          })
        });
      }
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Quality Score Comparison Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Before Score */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Before Cleaning Score</div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className={`text-3xl font-bold font-mono ${getScoreColor(beforeScore).split(' ')[0]}`}>
                {beforeScore}
              </span>
              <span className="text-sm font-medium text-slate-400">/ 100</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{getScoreCategory(beforeScore)} Quality</div>
          </div>
          <div className={`p-3 rounded-xl border ${getScoreColor(beforeScore)}`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Transition / Delta */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-center items-center text-center">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transformation Impact</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xl font-mono text-slate-400">{beforeScore}</span>
            <ArrowRight className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className={`text-2xl font-mono font-bold ${getScoreColor(afterScore).split(' ')[0]}`}>
              {afterScore}
            </span>
          </div>
          <div className="text-xs mt-1">
            {scoreDelta > 0 ? (
              <span className="text-emerald-400 font-semibold">+{scoreDelta} points improvement</span>
            ) : scoreDelta === 0 ? (
              <span className="text-slate-400">No score change pending</span>
            ) : (
              <span className="text-rose-400">{scoreDelta} points</span>
            )}
          </div>
        </div>

        {/* Cleaned Version Status */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pipeline Status</div>
            <div className="text-xl font-bold text-white mt-1">
              {pipeline.filter(s => s.enabled).length} Active Steps
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {preview ? `${preview.affectedRowCount} rows affected` : 'Preview pending'}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/30 text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* AI Assistant Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/50 via-slate-900/80 to-purple-950/40 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white">AI-Assisted Data Cleaning & Auto-Clean Plan</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phase 15.5
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Let AI analyze dataset quality issues and generate grounded, safe transformation recommendations.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigateTab('ai-assistant')}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Launch AI Cleaning Assistant</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dataset Summary Specs */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Dataset Characteristics</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
            <div className="text-slate-500 text-xs">Dataset Name</div>
            <div className="text-sm font-semibold text-white font-mono truncate mt-0.5">{dataset.name}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
            <div className="text-slate-500 text-xs">Original Rows</div>
            <div className="text-sm font-semibold text-white font-mono mt-0.5">
              {dataset.rowCount.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
            <div className="text-slate-500 text-xs">Cleaned Rows (Preview)</div>
            <div className="text-sm font-semibold text-emerald-400 font-mono mt-0.5">
              {preview ? preview.totalCleanedRows.toLocaleString() : dataset.rowCount.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80">
            <div className="text-slate-500 text-xs">Column Count</div>
            <div className="text-sm font-semibold text-white font-mono mt-0.5">{dataset.columns.length} columns</div>
          </div>
        </div>
      </div>

      {/* Recommended Actions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Wand2 className="w-4 h-4 text-indigo-400" />
            <span>Recommended Cleaning Operations</span>
          </h3>
          <span className="text-xs text-slate-500">{recommendations.length} recommendations available</span>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-300">No critical anomalies detected</p>
            <p className="text-xs text-slate-500 mt-1">
              You can manually configure missing value rules, text standardizations, or type conversions using the tabs above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendations.map(rec => (
              <div
                key={rec.id}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors flex items-start justify-between space-x-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-white">{rec.title}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-950/40 text-amber-300 border border-amber-900/40">
                      {rec.impact} Impact
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{rec.desc}</p>
                </div>
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button
                    onClick={() => onAddQuickStep(rec.step())}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    + Add Step
                  </button>
                  <button
                    onClick={() => onNavigateTab(rec.tab)}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Configure details"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
