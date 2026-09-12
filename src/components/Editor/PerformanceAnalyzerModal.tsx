import React, { useState, useEffect } from 'react';
import { X, Activity, AlertTriangle, CheckCircle, Info, ChevronRight, ChevronDown, Download, Copy, Database, GitBranch } from 'lucide-react';
import { PerformanceAnalysis, PlanNode } from '../../types/performance';
import { DiscoveredTable, TableDetailsResult } from '../../types/database';

interface PerformanceAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: PerformanceAnalysis | null;
  history: PerformanceAnalysis[];
  tables: DiscoveredTable[];
  tableDetailsCache: Record<string, TableDetailsResult>;
}

const PlanNodeView: React.FC<{ node: PlanNode, isRoot?: boolean }> = ({ node, isRoot = false }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`flex flex-col ${isRoot ? '' : 'ml-4 mt-2 border-l border-slate-700/50 pl-4'}`}>
      <div 
        className="flex items-start space-x-2 bg-slate-800/40 p-2 rounded border border-slate-700/50 cursor-pointer hover:bg-slate-800"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="mt-0.5">
          {node.Plans && node.Plans.length > 0 ? (
            expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0 text-sm">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-indigo-300">{node['Node Type']}</span>
            {node['Relation Name'] && (
              <span className="text-emerald-400 text-xs px-1.5 py-0.5 bg-emerald-400/10 rounded">
                {node['Relation Name']} {node['Alias'] && `(${node['Alias']})`}
              </span>
            )}
            {node['Index Name'] && (
              <span className="text-amber-400 text-xs px-1.5 py-0.5 bg-amber-400/10 rounded">
                Idx: {node['Index Name']}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
            <span>Cost: {node['Startup Cost']}..{node['Total Cost']}</span>
            <span>Rows: {node['Plan Rows']}</span>
            <span>Width: {node['Plan Width']}</span>
          </div>
          
          {node['Filter'] && (
            <div className="mt-1 text-xs font-mono text-slate-300 bg-slate-900/50 p-1 rounded break-all">
              Filter: {node['Filter']}
            </div>
          )}
          {node['Hash Cond'] && (
            <div className="mt-1 text-xs font-mono text-slate-300 bg-slate-900/50 p-1 rounded break-all">
              Cond: {node['Hash Cond']}
            </div>
          )}
        </div>
      </div>
      
      {expanded && node.Plans && (
        <div className="flex flex-col">
          {node.Plans.map((child, i) => (
            <PlanNodeView key={i} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

export const PerformanceAnalyzerModal: React.FC<PerformanceAnalyzerModalProps> = ({
  isOpen,
  onClose,
  analysis,
  history,
  tables,
  tableDetailsCache
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'tree' | 'indexes' | 'compare'>('summary');
  const [compareId, setCompareId] = useState<string>('');

  if (!isOpen) return null;
  
  if (!analysis) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-6">
          <p className="text-white">Analyzing...</p>
        </div>
      </div>
    );
  }

  const { summary, warnings, plan } = analysis;
  
  const getSeverity = () => {
    if (warnings.length > 2) return { text: 'Needs Attention', color: 'text-rose-400', bg: 'bg-rose-400/10' };
    if (warnings.length > 0) return { text: 'Warning', color: 'text-amber-400', bg: 'bg-amber-400/10' };
    return { text: 'Good', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
  };
  
  const severity = getSeverity();

  // Find all relation names in the plan
  const relationNames = new Set<string>();
  const findRelations = (node: PlanNode) => {
    if (node['Relation Name']) relationNames.add(node['Relation Name']);
    if (node.Plans) node.Plans.forEach(findRelations);
  };
  findRelations(plan);

  const compareAnalysis = history.find(h => h.id === compareId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-5xl h-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">SQL Query Performance Analyzer</h2>
            <span className={`ml-3 px-2 py-0.5 text-xs font-medium rounded ${severity.bg} ${severity.color}`}>
              {severity.text}
            </span>
            <span className="ml-2 text-xs text-slate-500 italic">Execution plan only — query was not executed.</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          {[
            { id: 'summary', label: 'Performance Summary', icon: <Activity className="w-4 h-4 mr-1.5" /> },
            { id: 'tree', label: 'Execution Plan', icon: <GitBranch className="w-4 h-4 mr-1.5" /> },
            { id: 'indexes', label: 'Indexes', icon: <Database className="w-4 h-4 mr-1.5" /> },
            { id: 'compare', label: 'Compare', icon: <Copy className="w-4 h-4 mr-1.5" /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          
          <div className="flex-1 flex justify-end items-center px-4">
            <button 
              onClick={() => {
                const data = JSON.stringify(analysis, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `performance-plan-${new Date().toISOString().slice(0,10)}.json`;
                a.click();
              }}
              className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
          
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400 mb-1">Estimated Cost</div>
                  <div className="text-xl font-semibold text-white">{summary.totalCost.toFixed(2)}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400 mb-1">Estimated Rows</div>
                  <div className="text-xl font-semibold text-white">{summary.rows.toLocaleString()}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400 mb-1">Primary Scan</div>
                  <div className="text-lg font-semibold text-white">{summary.primaryScan}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400 mb-1">Index Used</div>
                  <div className="text-lg font-semibold text-white">{summary.indexUsed ? 'Yes' : 'No'}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400 mb-1">Joins</div>
                  <div className="text-lg font-semibold text-white">{summary.joins}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400 mb-1">Sort Operations</div>
                  <div className="text-lg font-semibold text-white">{summary.sort ? 'Yes' : 'No'}</div>
                </div>
              </div>

              {warnings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mr-2" />
                    Performance Warnings
                  </h3>
                  <div className="space-y-2">
                    {warnings.map((w, i) => (
                      <div key={i} className="flex items-start space-x-2 bg-amber-400/5 border border-amber-400/20 p-3 rounded">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-amber-200/90">{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {warnings.length === 0 && (
                <div className="flex items-center space-x-2 bg-emerald-400/5 border border-emerald-400/20 p-4 rounded">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-emerald-300/90">No major performance issues detected in the query plan.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tree' && (
            <div className="bg-slate-900 border border-slate-800 rounded p-4 font-mono">
              <PlanNodeView node={plan} isRoot={true} />
            </div>
          )}

          {activeTab === 'indexes' && (
            <div className="space-y-6">
              <p className="text-sm text-slate-400">Available indexes for tables referenced in this query.</p>
              {Array.from(relationNames).map(relName => {
                // Find table details
                
                
                const indexes = analysis.indexes?.filter(i => i.tableName === relName) || [];
                if (indexes.length === 0) {
                  return (
                    <div key={relName} className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
                      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800 font-medium text-white flex items-center">
                        <Database className="w-4 h-4 mr-2 text-indigo-400" />
                        {relName}
                      </div>
                      <div className="p-4 text-sm text-slate-400">No indexes found for this table.</div>
                    </div>
                  );
                }

                return (
                  <div key={relName} className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800 font-medium text-white flex items-center">
                      <Database className="w-4 h-4 mr-2 text-indigo-400" />
                      {relName}
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="px-4 py-2 font-medium">Index Name</th>
                          <th className="px-4 py-2 font-medium">Columns</th>
                          <th className="px-4 py-2 font-medium">Unique</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {indexes.map(idx => (
                          <tr key={idx.indexName} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2 text-slate-300 font-mono text-xs">{idx.indexName}</td>
                            <td className="px-4 py-2 text-slate-300">{idx.columns.join(', ')}</td>
                            <td className="px-4 py-2">
                              {idx.isUnique ? (
                                <span className="text-emerald-400 text-xs px-1.5 py-0.5 bg-emerald-400/10 rounded">Yes</span>
                              ) : (
                                <span className="text-slate-500 text-xs">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {relationNames.size === 0 && (
                <div className="text-sm text-slate-400">No relations detected in the plan.</div>
              )}
            </div>
          )}

          {activeTab === 'compare' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="text-sm text-slate-300">Compare current plan with:</div>
                <select
                  value={compareId}
                  onChange={e => setCompareId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-sm text-white rounded px-3 py-1.5 min-w-[300px]"
                >
                  <option value="">Select a previous analysis...</option>
                  {history.filter(h => h.id !== analysis.id).map(h => (
                    <option key={h.id} value={h.id}>
                      {new Date(h.timestamp).toLocaleTimeString()} - Cost: {h.summary.totalCost.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {compareAnalysis && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-indigo-300">Current Query</h3>
                    <div className="bg-slate-900 border border-slate-800 rounded p-4 text-sm space-y-2">
                      <div className="flex justify-between"><span className="text-slate-400">Cost</span><span className="text-white">{summary.totalCost.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Rows</span><span className="text-white">{summary.rows.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Joins</span><span className="text-white">{summary.joins}</span></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-emerald-300">Previous Query</h3>
                    <div className="bg-slate-900 border border-slate-800 rounded p-4 text-sm space-y-2">
                      <div className="flex justify-between"><span className="text-slate-400">Cost</span><span className="text-white">{compareAnalysis.summary.totalCost.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Rows</span><span className="text-white">{compareAnalysis.summary.rows.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Joins</span><span className="text-white">{compareAnalysis.summary.joins}</span></div>
                    </div>
                  </div>
                  
                  <div className="col-span-2 bg-slate-900 border border-slate-800 rounded p-4">
                    <h3 className="text-sm font-semibold text-white mb-2">Conclusion</h3>
                    <p className="text-sm text-slate-300">
                      {summary.totalCost < compareAnalysis.summary.totalCost 
                        ? 'Current query has a lower estimated planner cost, suggesting it may perform better.'
                        : summary.totalCost > compareAnalysis.summary.totalCost
                          ? 'Current query has a higher estimated planner cost. The previous query is likely more efficient.'
                          : 'Both queries have similar estimated planner costs.'}
                    </p>
                  </div>
                </div>
              )}
              
              {!compareAnalysis && history.length <= 1 && (
                <div className="text-sm text-slate-400 flex items-center">
                  <Info className="w-4 h-4 mr-2" />
                  Run another performance analysis to compare queries.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
