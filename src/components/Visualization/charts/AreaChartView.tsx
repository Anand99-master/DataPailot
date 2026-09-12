import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { ChartConfig } from '../../../types/visualization';
import { ProcessedDataPoint, VisualizationDataProcessor } from '../../../services/visualizationDataProcessor';

interface AreaChartViewProps {
  data: ProcessedDataPoint[];
  config: ChartConfig;
}

const PALETTE = [
  { stroke: '#6366f1', fillStart: '#6366f1', id: 'gradIndigo' },
  { stroke: '#10b981', fillStart: '#10b981', id: 'gradEmerald' },
  { stroke: '#06b6d4', fillStart: '#06b6d4', id: 'gradCyan' }
];

export const AreaChartView: React.FC<AreaChartViewProps> = ({ data, config }) => {
  const measures = [config.yAxis, ...(config.secondaryMeasures || [])];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-lg p-3 text-xs">
          <div className="font-semibold text-slate-200 mb-1.5 pb-1 border-b border-slate-800">
            {label}
          </div>
          {payload.map((entry: any, idx: number) => (
            <div key={`tip-${idx}`} className="flex items-center justify-between space-x-4 py-0.5">
              <span className="flex items-center space-x-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-medium text-slate-100">
                {VisualizationDataProcessor.formatNumber(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="area-chart-stage" className="w-full h-full min-h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
          <defs>
            {PALETTE.map(p => (
              <linearGradient key={p.id} id={p.id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={p.fillStart} stopOpacity={0.4} />
                <stop offset="95%" stopColor={p.fillStart} stopOpacity={0.0} />
              </linearGradient>
            ))}
          </defs>

          {config.showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
          )}

          <XAxis
            dataKey="xLabel"
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            angle={-25}
            textAnchor="end"
            height={50}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={val => VisualizationDataProcessor.formatNumber(val)}
          />

          <Tooltip content={<CustomTooltip />} />
          {config.showLegend && <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />}

          {measures.map((mKey, idx) => {
            const p = PALETTE[idx % PALETTE.length];
            return (
              <Area
                key={mKey}
                type="monotone"
                dataKey={mKey}
                name={mKey.replace(/_/g, ' ')}
                stroke={p.stroke}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#${p.id})`}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
