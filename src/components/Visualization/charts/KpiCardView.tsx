import React from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, Activity } from 'lucide-react';
import { ChartConfig } from '../../../types/visualization';
import { VisualizationDataProcessor, KpiMetricSummary } from '../../../services/visualizationDataProcessor';

interface KpiCardViewProps {
  rows: Record<string, unknown>[];
  config: ChartConfig;
}

export const KpiCardView: React.FC<KpiCardViewProps> = ({ rows, config }) => {
  const metric = VisualizationDataProcessor.computeKpi(rows, config.yAxis);

  const isPositive = (metric.changePercent ?? 0) > 0;
  const isNegative = (metric.changePercent ?? 0) < 0;
  const isZero = (metric.changePercent ?? 0) === 0;

  return (
    <div id="kpi-card-container" className="flex flex-col items-center justify-center h-full w-full p-8">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Icon & Title */}
        <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 text-indigo-400">
          <Activity className="w-6 h-6" />
        </div>

        <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-2">
          {config.title || metric.metricLabel}
        </div>

        {config.subtitle && (
          <div className="text-xs text-slate-400 mb-4">{config.subtitle}</div>
        )}

        {/* Primary Value */}
        <div id="kpi-primary-value" className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight my-2">
          {metric.formattedCurrent}
        </div>

        {/* Optional Comparison */}
        {metric.hasComparison && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 w-full grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Previous</span>
              <span className="text-sm font-semibold text-slate-200 mt-0.5">
                {metric.formattedPrevious}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Change</span>
              <div
                className={`flex items-center space-x-1 mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  isPositive
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                    : isNegative
                    ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    : 'text-slate-400 bg-slate-800'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : isNegative ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span>
                  {metric.changePercent !== null
                    ? `${metric.changePercent > 0 ? '+' : ''}${metric.changePercent.toFixed(1)}%`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
