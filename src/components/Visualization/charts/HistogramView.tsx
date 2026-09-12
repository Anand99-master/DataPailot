import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList
} from 'recharts';
import { ChartConfig } from '../../../types/visualization';
import { VisualizationDataProcessor } from '../../../services/visualizationDataProcessor';

interface HistogramViewProps {
  rows: Record<string, unknown>[];
  config: ChartConfig;
}

export const HistogramView: React.FC<HistogramViewProps> = ({ rows, config }) => {
  const metricCol = config.xAxis || config.yAxis;
  const binCount = config.binCount || 20;

  const bins = VisualizationDataProcessor.computeHistogram(
    rows,
    metricCol,
    binCount,
    config.treatNullAsZero
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const b = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-lg p-3 text-xs">
          <div className="font-semibold text-slate-200 mb-1">
            Interval: <span className="font-mono text-indigo-400">{b.binRange}</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="text-slate-400">Frequency (Count):</span>
            <span className="font-mono font-bold text-emerald-400">{b.count}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="histogram-stage" className="w-full h-full min-h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
          {config.showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
          )}

          <XAxis
            dataKey="binRange"
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <YAxis
            type="number"
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            allowDecimals={false}
          />

          <Tooltip content={<CustomTooltip />} />

          <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]}>
            {config.showDataLabels && (
              <LabelList
                dataKey="count"
                position="top"
                formatter={(val: any) => (val > 0 ? val : '')}
                fill="#94a3b8"
                fontSize={10}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
