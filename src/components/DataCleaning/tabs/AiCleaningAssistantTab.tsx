import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Wand2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Check,
  X,
  ArrowRight,
  RotateCcw,
  Layers,
  Activity,
  Filter,
  Copy,
  Calendar,
  Type,
  DollarSign,
  Columns,
  Info,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';
import {
  AiCleaningPlan,
  AiCleaningRecommendation,
  AiRecommendationConfidence,
  AiRecommendationRisk,
  AiRecommendationPriority,
  AiRecommendationCategory,
  AiRecommendationStatus,
  AiRecommendationHistoryItem,
  AiReanalysisResult
} from '../../../types/aiCleaning';
import { CleaningApiClient } from '../../../services/cleaningApi';
import { recommendationToTransformStep } from '../../../utils/aiCleaningHelper';

interface AiCleaningAssistantTabProps {
  dataset: ImportedDataset;
  pipeline: TransformStep[];
  onAddStep: (step: TransformStep) => void;
  onAddMultipleSteps?: (steps: TransformStep[]) => void;
  onNavigateToPipeline?: () => void;
}

export const AiCleaningAssistantTab: React.FC<AiCleaningAssistantTabProps> = ({
  dataset,
  pipeline,
  onAddStep,
  onAddMultipleSteps,
  onNavigateToPipeline
}) => {
  const [plan, setPlan] = useState<AiCleaningPlan | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalysisResult, setReanalysisResult] = useState<AiReanalysisResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'high_confidence'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reviewingRec, setReviewingRec] = useState<AiCleaningRecommendation | null>(null);
  const [recommendationStatuses, setRecommendationStatuses] = useState<Record<string, AiRecommendationStatus>>({});
  const [history, setHistory] = useState<AiRecommendationHistoryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);

  // Auto-analyze or load on initial dataset selection if not yet analyzed
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setStatusMessage(null);
    try {
      const result = await CleaningApiClient.analyzeDatasetWithAi(dataset.datasetId, pipeline);
      setPlan(result);
      // Initialize status map
      const statusMap: Record<string, AiRecommendationStatus> = {};
      result.recommendations.forEach(r => {
        // Check if step already exists in pipeline
        const alreadyInPipeline = pipeline.some(
          s => s.aiRecommendationId === r.id || (s.type === r.transformationType && s.column === r.column)
        );
        statusMap[r.id] = alreadyInPipeline ? 'Approved' : 'Pending';
      });
      setRecommendationStatuses(statusMap);
      setStatusMessage({
        type: 'success',
        text: `Analysis complete: Found ${result.totalRecommendations} recommendations (${result.highConfidenceCount} High Confidence). Mode: ${result.aiMode === 'gemini' ? 'Gemini AI' : 'Deterministic Engine'}.`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to analyze dataset.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    setStatusMessage(null);
    try {
      const res = await CleaningApiClient.reanalyzeDatasetWithAi(dataset.datasetId, pipeline);
      setReanalysisResult(res);
      setPlan(res.plan);
      const statusMap: Record<string, AiRecommendationStatus> = {};
      res.plan.recommendations.forEach(r => {
        const alreadyInPipeline = pipeline.some(
          s => s.aiRecommendationId === r.id || (s.type === r.transformationType && s.column === r.column)
        );
        statusMap[r.id] = alreadyInPipeline ? 'Approved' : 'Pending';
      });
      setRecommendationStatuses(statusMap);
      setStatusMessage({
        type: 'success',
        text: `Re-analysis complete! Resolved ${res.resolvedIssues.length} issues. Remaining issues: ${res.remainingIssues.length}.`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to re-analyze dataset.' });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleApprove = (rec: AiCleaningRecommendation) => {
    const step = recommendationToTransformStep(rec);
    onAddStep(step);

    setRecommendationStatuses(prev => ({ ...prev, [rec.id]: 'Approved' }));
    setHistory(prev => [
      {
        recommendationId: rec.id,
        datasetId: dataset.datasetId,
        timestamp: new Date().toLocaleTimeString(),
        problem: rec.problem,
        recommendation: rec.proposedTransformation,
        confidence: rec.confidence,
        status: 'Approved'
      },
      ...prev
    ]);

    setStatusMessage({
      type: 'success',
      text: `Approved and added "${rec.proposedTransformation}" with tag [AI Recommended] to pipeline.`
    });
  };

  const handleReject = (rec: AiCleaningRecommendation) => {
    setRecommendationStatuses(prev => ({ ...prev, [rec.id]: 'Rejected' }));
    setHistory(prev => [
      {
        recommendationId: rec.id,
        datasetId: dataset.datasetId,
        timestamp: new Date().toLocaleTimeString(),
        problem: rec.problem,
        recommendation: rec.proposedTransformation,
        confidence: rec.confidence,
        status: 'Rejected'
      },
      ...prev
    ]);
    setStatusMessage({
      type: 'info',
      text: `Rejected recommendation: "${rec.proposedTransformation}".`
    });
  };

  const handleApproveAllHighConfidence = () => {
    if (!plan) return;

    // Filter strictly High confidence AND Low risk recommendations that are currently Pending
    const candidates = plan.recommendations.filter(
      r => recommendationStatuses[r.id] === 'Pending' && r.confidence === 'High' && r.risk === 'Low'
    );

    if (candidates.length === 0) {
      setStatusMessage({
        type: 'info',
        text: 'No pending High-Confidence, Low-Risk recommendations available to approve.'
      });
      return;
    }

    const newSteps = candidates.map(r => recommendationToTransformStep(r));

    if (onAddMultipleSteps) {
      onAddMultipleSteps(newSteps);
    } else {
      newSteps.forEach(s => onAddStep(s));
    }

    const updatedMap = { ...recommendationStatuses };
    candidates.forEach(r => {
      updatedMap[r.id] = 'Approved';
    });
    setRecommendationStatuses(updatedMap);

    const historyItems: AiRecommendationHistoryItem[] = candidates.map(r => ({
      recommendationId: r.id,
      datasetId: dataset.datasetId,
      timestamp: new Date().toLocaleTimeString(),
      problem: r.problem,
      recommendation: r.proposedTransformation,
      confidence: r.confidence,
      status: 'Approved'
    }));
    setHistory(prev => [...historyItems, ...prev]);

    setStatusMessage({
      type: 'success',
      text: `Approved and added ${candidates.length} High-Confidence safe cleaning steps to pipeline.`
    });
  };

  const getFilteredRecommendations = () => {
    if (!plan) return [];
    return plan.recommendations.filter(r => {
      const status = recommendationStatuses[r.id] || 'Pending';
      if (activeFilter === 'pending' && status !== 'Pending') return false;
      if (activeFilter === 'approved' && status !== 'Approved') return false;
      if (activeFilter === 'rejected' && status !== 'Rejected') return false;
      if (activeFilter === 'high_confidence' && r.confidence !== 'High') return false;

      if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;

      return true;
    });
  };

  const filteredRecs = getFilteredRecommendations();

  // Category Icon helper
  const getCategoryIcon = (category: AiRecommendationCategory) => {
    switch (category) {
      case 'missing': return <Filter className="w-3.5 h-3.5 text-blue-400" />;
      case 'duplicates': return <Copy className="w-3.5 h-3.5 text-purple-400" />;
      case 'text': return <Type className="w-3.5 h-3.5 text-emerald-400" />;
      case 'numeric': return <DollarSign className="w-3.5 h-3.5 text-amber-400" />;
      case 'dates': return <Calendar className="w-3.5 h-3.5 text-rose-400" />;
      case 'outliers': return <Activity className="w-3.5 h-3.5 text-orange-400" />;
      case 'types': return <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />;
      case 'mapping': return <Wand2 className="w-3.5 h-3.5 text-teal-400" />;
      default: return <Columns className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-900 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/80 border-rose-900 text-rose-200'
              : 'bg-indigo-950/80 border-indigo-900 text-indigo-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* Initial Hero / Launch State when not analyzed */}
      {!plan && (
        <div className="p-8 rounded-2xl bg-gradient-to-b from-indigo-950/30 to-slate-900/60 border border-indigo-900/40 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto shadow-inner">
            <Wand2 className="w-8 h-8" />
          </div>
          <div className="max-w-xl mx-auto space-y-2">
            <h3 className="text-lg font-bold text-white">AI-Assisted Data Cleaning & Auto-Clean Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Analyze dataset <span className="text-indigo-300 font-mono font-semibold">{dataset.name}</span> ({dataset.rowCount} rows, {dataset.columns.length} columns) to detect data quality issues, missing values, duplicates, formatting anomalies, and statistical outliers with grounded, safe transformation recommendations.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Dataset Quality...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Dataset & Recommend Steps</span>
                </>
              )}
            </button>
          </div>

          {/* Safety Guarantees Callout */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Non-Destructive (Original Data Untouched)</span>
            </span>
            <span className="flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Explicit User Approval Required</span>
            </span>
            <span className="flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span>Grounded in Actual Profiling</span>
            </span>
          </div>
        </div>
      )}

      {/* Main AI Plan Dashboard when analyzed */}
      {plan && (
        <div className="space-y-6">
          {/* Top Summary Banner: AI Cleaning Plan Overview */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-900">
                    AI CLEANING PLAN
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Dataset: {plan.datasetName}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                    Mode: {plan.aiMode === 'gemini' ? 'Gemini AI Powered' : 'Deterministic Rule Engine'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  Quality Recommendations & Optimization Strategy
                </h3>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleReanalyze}
                  disabled={isReanalyzing}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium flex items-center space-x-1.5 border border-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />
                  <span>{isReanalyzing ? 'Re-analyzing...' : 'Re-analyze Dataset'}</span>
                </button>

                <button
                  onClick={handleApproveAllHighConfidence}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve All High Confidence</span>
                </button>
              </div>
            </div>

            {/* Score & Metric Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {/* Current DQ Score */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 uppercase font-mono">Current DQ Score</div>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className={`text-xl font-bold font-mono ${
                    plan.currentDqScore >= 80 ? 'text-emerald-400' : plan.currentDqScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {plan.currentDqScore}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">/ 100</span>
                </div>
              </div>

              {/* Estimated Improvement */}
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/40">
                <div className="text-[11px] text-indigo-300 uppercase font-mono">Estimated After Plan</div>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {plan.estimatedDqScore}
                  </span>
                  <span className="text-[10px] text-indigo-300 font-mono">(Estimated)</span>
                </div>
              </div>

              {/* Total Recommendations */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 uppercase font-mono">Recommended Steps</div>
                <div className="text-xl font-bold text-white font-mono mt-1">
                  {plan.totalRecommendations}
                </div>
              </div>

              {/* High Confidence */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 uppercase font-mono">High Confidence</div>
                <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                  {plan.highConfidenceCount}
                </div>
              </div>

              {/* Medium Confidence */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 uppercase font-mono">Medium Confidence</div>
                <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                  {plan.mediumConfidenceCount}
                </div>
              </div>

              {/* Critical Issues */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400 uppercase font-mono">Critical Issues</div>
                <div className={`text-xl font-bold font-mono mt-1 ${plan.criticalIssuesCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {plan.criticalIssuesCount}
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Category Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            {/* Status Filter Tabs */}
            <div className="flex items-center space-x-1 overflow-x-auto">
              {[
                { id: 'all', label: 'All Recommendations', count: plan.recommendations.length },
                {
                  id: 'pending',
                  label: 'Pending',
                  count: plan.recommendations.filter(r => recommendationStatuses[r.id] === 'Pending').length
                },
                {
                  id: 'approved',
                  label: 'Approved (in Pipeline)',
                  count: plan.recommendations.filter(r => recommendationStatuses[r.id] === 'Approved').length
                },
                {
                  id: 'rejected',
                  label: 'Rejected',
                  count: plan.recommendations.filter(r => recommendationStatuses[r.id] === 'Rejected').length
                },
                {
                  id: 'high_confidence',
                  label: 'High Confidence',
                  count: plan.highConfidenceCount
                }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                    activeFilter === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/60">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Category:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-hidden"
              >
                <option value="all">All Categories</option>
                <option value="missing">Missing Values</option>
                <option value="duplicates">Duplicates</option>
                <option value="text">Text Cleaning</option>
                <option value="numeric">Numeric & Currency</option>
                <option value="dates">Date Standardization</option>
                <option value="types">Data Types</option>
                <option value="outliers">Outliers</option>
                <option value="mapping">Value Mapping</option>
              </select>
            </div>
          </div>

          {/* Recommendations List */}
          <div className="space-y-3">
            {filteredRecs.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
                No recommendations match the selected filter.
              </div>
            ) : (
              filteredRecs.map((rec, index) => {
                const status = recommendationStatuses[rec.id] || 'Pending';
                const isApproved = status === 'Approved';
                const isRejected = status === 'Rejected';
                const isExpanded = expandedRecId === rec.id;

                return (
                  <div
                    key={rec.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isApproved
                        ? 'bg-emerald-950/20 border-emerald-900/60'
                        : isRejected
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        : rec.priority === 'Critical'
                        ? 'bg-slate-900/90 border-rose-900/50'
                        : rec.priority === 'High'
                        ? 'bg-slate-900/90 border-amber-900/40'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="p-4 space-y-3">
                      {/* Top Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Priority Pill */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              rec.priority === 'Critical'
                                ? 'bg-rose-950 text-rose-300 border border-rose-900'
                                : rec.priority === 'High'
                                ? 'bg-amber-950 text-amber-300 border border-amber-900'
                                : rec.priority === 'Medium'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-900'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {rec.priority}
                          </span>

                          {/* Category Pill with Icon */}
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 flex items-center space-x-1">
                            {getCategoryIcon(rec.category)}
                            <span className="capitalize">{rec.category}</span>
                          </span>

                          {/* Column Pill */}
                          {rec.column && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800/80 text-amber-300 border border-slate-700">
                              [{rec.column}]
                            </span>
                          )}

                          {/* Transformation Type */}
                          <span className="text-[11px] font-mono text-slate-400">
                            {rec.transformationType.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Badges: Confidence & Risk */}
                        <div className="flex items-center space-x-2">
                          {/* Confidence */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center space-x-1 ${
                              rec.confidence === 'High'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-900'
                                : rec.confidence === 'Medium'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-900'
                                : 'bg-rose-950/80 text-rose-300 border border-rose-900'
                            }`}
                            title={rec.confidenceReason}
                          >
                            <span>Confidence: {rec.confidence} ({rec.confidenceScore}%)</span>
                          </span>

                          {/* Risk */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.risk === 'Low'
                                ? 'bg-slate-800 text-emerald-400'
                                : rec.risk === 'Medium'
                                ? 'bg-slate-800 text-amber-400'
                                : 'bg-slate-800 text-rose-400'
                            }`}
                          >
                            {rec.risk} Risk
                          </span>

                          {/* Status Pill */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isApproved
                                ? 'bg-emerald-600 text-white'
                                : isRejected
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-indigo-950 text-indigo-300 border border-indigo-900'
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                      </div>

                      {/* Main Problem & Proposed Transformation Explanation */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* What is wrong? */}
                        <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/60 space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Problem Identified</span>
                          </div>
                          <p className="text-slate-200 font-medium">{rec.problem}</p>
                          <p className="text-slate-400 text-[11px]">{rec.why}</p>
                        </div>

                        {/* Proposed Transformation */}
                        <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/60 space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1">
                            <Wand2 className="w-3 h-3" />
                            <span>Proposed Transformation</span>
                          </div>
                          <p className="text-white font-semibold">{rec.proposedTransformation}</p>
                          <p className="text-slate-400 text-[11px]">{rec.whatCouldChange}</p>
                        </div>
                      </div>

                      {/* Row Impact and Sample Preview Snippet */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-slate-800/60">
                        <div className="flex items-center space-x-3 text-slate-400">
                          <span className="text-[11px]">
                            Affected rows: <strong className="text-indigo-300 font-mono">{rec.estimatedRowsAffected}</strong>
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-[11px] italic text-slate-400">
                            {rec.confidenceReason}
                          </span>
                        </div>

                        {/* Action Controls */}
                        <div className="flex items-center space-x-2">
                          {/* Review Sample Button */}
                          <button
                            onClick={() => setReviewingRec(rec)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center space-x-1 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review Sample</span>
                          </button>

                          {/* Reject Button */}
                          {!isRejected && (
                            <button
                              onClick={() => handleReject(rec)}
                              disabled={isApproved}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 text-xs font-medium flex items-center space-x-1 transition-colors disabled:opacity-30"
                              title="Reject recommendation"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          )}

                          {/* Approve Button */}
                          {!isApproved ? (
                            <button
                              onClick={() => handleApprove(rec)}
                              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1 shadow-xs transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve Step</span>
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-900 text-xs font-bold flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>In Pipeline</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Remaining Issues & Re-Analysis Section */}
          {reanalysisResult && (
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold text-white">Re-Analysis & Issue Resolution Status</h4>
                </div>
                <div className="flex items-center space-x-2 font-mono text-xs">
                  <span className="text-slate-400">Score Before: {reanalysisResult.beforeDqScore}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-emerald-400 font-bold">Actual After: {reanalysisResult.actualDqScore}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Resolved Issues */}
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/50 space-y-2">
                  <div className="font-bold text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Resolved Issues ({reanalysisResult.resolvedIssues.length})</span>
                  </div>
                  {reanalysisResult.resolvedIssues.length === 0 ? (
                    <p className="text-slate-500 italic">No issues resolved yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {reanalysisResult.resolvedIssues.map((res, i) => (
                        <li key={i} className="text-emerald-200 flex items-center space-x-1.5">
                          <span>✓</span>
                          <span>{res}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Remaining Issues */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="font-bold text-amber-400 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Remaining Issues ({reanalysisResult.remainingIssues.length})</span>
                  </div>
                  {reanalysisResult.remainingIssues.length === 0 ? (
                    <p className="text-emerald-400 font-medium">All detected quality issues resolved!</p>
                  ) : (
                    <ul className="space-y-1">
                      {reanalysisResult.remainingIssues.map((iss, i) => (
                        <li key={i} className="text-slate-300 flex items-start space-x-1.5">
                          <span className="text-amber-400">•</span>
                          <span>
                            <strong>[{iss.column}]</strong> {iss.issue} ({iss.affectedRowCount} rows)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recommendation History Log Drawer / Section */}
          {history.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                  AI Recommendation Decision History ({history.length})
                </span>
                <button
                  onClick={() => setHistory([])}
                  className="text-slate-500 hover:text-slate-300 text-[11px]"
                >
                  Clear History
                </button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-slate-500 text-[10px]">{h.timestamp}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          h.status === 'Approved' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        {h.status}
                      </span>
                      <span className="text-slate-200 truncate">{h.recommendation}</span>
                    </div>
                    <span className="text-slate-500 text-[10px] flex-shrink-0">
                      Conf: {h.confidence}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Sample Modal / Drawer */}
      {reviewingRec && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Sample Value Diff: {reviewingRec.proposedTransformation}
                </h3>
              </div>
              <button
                onClick={() => setReviewingRec(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Target Scope
                </div>
                <div className="text-slate-200">
                  Column: <strong className="text-amber-300 font-mono">[{reviewingRec.column || 'Whole Dataset'}]</strong> • Operation: <strong className="text-indigo-300 font-mono">{reviewingRec.transformationType}</strong>
                </div>
              </div>

              {/* Sample Before / After Comparison Table */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Sample Transformations (Before vs After)
                </div>

                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Original (Before)</th>
                        <th className="p-2.5">Transformed (After)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                      {reviewingRec.sampleBefore.map((bVal, idx) => {
                        const aVal = reviewingRec.sampleAfter[idx] ?? reviewingRec.sampleAfter[0] ?? '(Transformed)';
                        return (
                          <tr key={idx}>
                            <td className="p-2.5 text-rose-300 bg-rose-950/10">
                              {typeof bVal === 'object' ? JSON.stringify(bVal) : String(bVal)}
                            </td>
                            <td className="p-2.5 text-emerald-300 bg-emerald-950/10">
                              {typeof aVal === 'object' ? JSON.stringify(aVal) : String(aVal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edge cases & Potential issues */}
              {reviewingRec.potentialIssues && reviewingRec.potentialIssues.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-1 text-amber-200">
                  <div className="font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Potential Edge Cases</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {reviewingRec.potentialIssues.map((iss, i) => (
                      <li key={i}>{iss}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setReviewingRec(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Close
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    handleReject(reviewingRec);
                    setReviewingRec(null);
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 text-xs font-medium transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => {
                    handleApprove(reviewingRec);
                    setReviewingRec(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & Add to Pipeline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
