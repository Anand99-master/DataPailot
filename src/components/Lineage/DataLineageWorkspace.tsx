import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Database, Filter, Search, Download, GitMerge, FileSpreadsheet, AlertTriangle, Link, CheckCircle, Info, Key, Hash, X, RefreshCw, Code2, Map } from 'lucide-react';
import { DiscoveredTable, TableDetailsResult, DatabaseRelationship } from '../../types/database';
import { LineageGraph } from './LineageGraph';
import { exportLineageToExcel, exportLineageToJson, exportLineageToCsv } from './exportUtils';
import { findJoinPath, generateJoinSql } from './joinPathUtils';
import { detectOrphans } from './orphanDetector';
import { DatabaseApiClient } from '../../services/databaseApi';

interface DataLineageWorkspaceProps {
  tables: DiscoveredTable[];
  relationships: DatabaseRelationship[];
  tableDetailsCache: Record<string, TableDetailsResult>;
  onSelectTable: (table: DiscoveredTable) => void;
  onLoadTableDetails: (schema: string, name: string) => Promise<void>;
}

export const DataLineageWorkspace: React.FC<DataLineageWorkspaceProps> = ({
  tables,
  relationships,
  tableDetailsCache,
  onSelectTable,
  onLoadTableDetails
}) => {
  const [activeTab, setActiveTab] = useState<'graph' | 'overview' | 'pathfinder' | 'orphans'>('graph');
  const [selectedNode, setSelectedNode] = useState<string | null>(null); // format: schema.name
  const [selectedColumn, setSelectedColumn] = useState<{table: string, column: string} | null>(null);
  
  // Path finder state
  const [pathFrom, setPathFrom] = useState<string>('');
  const [pathTo, setPathTo] = useState<string>('');
  
  // Graph controls
  const [graphZoom, setGraphZoom] = useState(1);
  
  // Auto-load all details for the graph if needed (be careful not to spam if too many tables)
  // To avoid spamming, we will rely on existing tableDetailsCache and the global relationships list.
  
  const handleExport = (format: 'json' | 'csv' | 'excel') => {
    switch (format) {
      case 'json':
        exportLineageToJson(tables, relationships, tableDetailsCache);
        break;
      case 'csv':
        exportLineageToCsv(tables, relationships);
        break;
      case 'excel':
        exportLineageToExcel(tables, relationships, tableDetailsCache);
        break;
    }
  };

  const orphans = useMemo(() => detectOrphans(tables, relationships), [tables, relationships]);

  const joinPath = useMemo(() => {
    if (!pathFrom || !pathTo || pathFrom === pathTo) return null;
    return findJoinPath(pathFrom, pathTo, tables, relationships);
  }, [pathFrom, pathTo, tables, relationships]);

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-300">
      {/* LEFT SIDEBAR - Controls & Navigation */}
      <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <Map className="w-5 h-5 mr-2 text-amber-400" />
            Data Lineage
          </h2>
          <p className="text-xs text-slate-500 mt-1">Analyze dependencies and join paths</p>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button 
            onClick={() => setActiveTab('graph')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 ${activeTab === 'graph' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'}`}
          >Graph</button>
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 ${activeTab === 'overview' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'}`}
          >Overview</button>
          <button 
            onClick={() => setActiveTab('pathfinder')}
            className={`flex-1 py-2 text-xs font-medium border-b-2 ${activeTab === 'pathfinder' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'}`}
          >Join Path</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
             <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Schema Overview</h3>
                  <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">{tables.length} tables</span>
                </div>
                <div className="space-y-1">
                  {tables.map(t => (
                    <button 
                      key={`${t.schema}.${t.name}`}
                      onClick={() => {
                        setSelectedNode(`${t.schema}.${t.name}`);
                        setActiveTab('graph');
                      }}
                      className="w-full text-left px-3 py-2 text-sm bg-slate-800/40 hover:bg-slate-800 rounded border border-transparent hover:border-slate-700 transition-colors"
                    >
                      <div className="font-medium text-indigo-300">{t.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{t.approximateRowCount?.toLocaleString() || 0} rows</div>
                    </button>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'pathfinder' && (
            <div className="p-4 space-y-4">
               <h3 className="text-sm font-semibold text-white flex items-center">
                 <GitMerge className="w-4 h-4 mr-2 text-emerald-400" />
                 Join Path Finder
               </h3>
               <p className="text-xs text-slate-400">Calculate shortest valid FK path.</p>
               
               <div className="space-y-3">
                 <div>
                   <label className="text-xs font-medium text-slate-300">From Table</label>
                   <select 
                     value={pathFrom} 
                     onChange={e => setPathFrom(e.target.value)}
                     className="mt-1 w-full bg-slate-900 border border-slate-700 text-sm rounded p-1.5 text-white"
                   >
                     <option value="">Select table...</option>
                     {tables.map(t => <option key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>{t.name}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-medium text-slate-300">To Table</label>
                   <select 
                     value={pathTo} 
                     onChange={e => setPathTo(e.target.value)}
                     className="mt-1 w-full bg-slate-900 border border-slate-700 text-sm rounded p-1.5 text-white"
                   >
                     <option value="">Select table...</option>
                     {tables.map(t => <option key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>{t.name}</option>)}
                   </select>
                 </div>
               </div>

               {joinPath && joinPath.length > 0 ? (
                 <div className="mt-4 p-3 bg-slate-900 border border-slate-700 rounded-lg">
                   <h4 className="text-xs font-semibold text-white mb-2">Join Steps</h4>
                   <div className="space-y-2">
                     {joinPath.map((step, idx) => (
                       <div key={idx} className="text-xs font-mono bg-slate-800 p-2 rounded text-slate-300">
                         {step.sourceTable}.{step.sourceColumn} <br/>
                         = {step.targetTable}.{step.targetColumn}
                       </div>
                     ))}
                   </div>
                   <div className="mt-4 pt-3 border-t border-slate-800">
                     <button
                       onClick={() => {
                         const sql = generateJoinSql(pathFrom, pathTo, joinPath);
                         alert("Generated SQL:\n\n" + sql);
                       }}
                       className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded flex items-center justify-center transition-colors"
                     >
                       <Code2 className="w-3.5 h-3.5 mr-1.5" />
                       Generate JOIN SQL
                     </button>
                   </div>
                 </div>
               ) : (pathFrom && pathTo && pathFrom !== pathTo) ? (
                 <div className="mt-4 p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg text-xs text-rose-300 flex items-start">
                   <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                   <span>No valid foreign key path found between these tables.</span>
                 </div>
               ) : null}
            </div>
          )}

          {activeTab === 'orphans' && (
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2 text-rose-400" />
                Schema Anomalies
              </h3>
              
              <div className="space-y-3">
                {orphans.disconnectedTables.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700 p-3 rounded">
                    <div className="text-xs font-semibold text-slate-300 mb-1">Disconnected Tables</div>
                    <div className="text-xs text-slate-500 mb-2">Tables with no relationships</div>
                    <div className="flex flex-wrap gap-1">
                      {orphans.disconnectedTables.map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px]">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {orphans.brokenRelationships.length > 0 && (
                  <div className="bg-rose-950/30 border border-rose-900/50 p-3 rounded">
                    <div className="text-xs font-semibold text-rose-300 mb-1">Broken Relationships</div>
                    <div className="text-xs text-rose-400/70 mb-2">FKs pointing to missing tables/columns</div>
                    <ul className="space-y-1">
                      {orphans.brokenRelationships.map((br, i) => (
                        <li key={i} className="text-xs text-rose-300 bg-rose-950/50 p-1.5 rounded font-mono">
                          {br}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {orphans.disconnectedTables.length === 0 && orphans.brokenRelationships.length === 0 && (
                  <div className="text-xs text-emerald-400 bg-emerald-400/10 p-3 rounded flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    No schema anomalies detected.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Export Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 space-y-2">
          <button onClick={() => setActiveTab('orphans')} className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded border border-slate-700 transition-colors">
            <span className="flex items-center"><AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-400" /> Orphans / Issues</span>
            <span className="bg-slate-700 px-1.5 rounded-full text-[10px]">{orphans.brokenRelationships.length}</span>
          </button>
          
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <button onClick={() => handleExport('json')} className="flex items-center justify-center space-x-1.5 px-2 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors">
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button onClick={() => handleExport('excel')} className="flex items-center justify-center space-x-1.5 px-2 py-1.5 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 rounded border border-emerald-800/50 transition-colors">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT MAIN - Graph & Details */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 relative bg-slate-950">
          <LineageGraph 
            tables={tables} 
            relationships={relationships} 
            selectedNode={selectedNode}
            onSelectNode={(nodeId) => {
              setSelectedNode(nodeId);
              // auto-load details
              if (nodeId) {
                const [s, n] = nodeId.split('.');
                if (!tableDetailsCache[nodeId]) {
                  onLoadTableDetails(s, n);
                }
              }
            }}
          />
        </div>

        {/* Bottom Details Panel (when a node is selected) */}
        {selectedNode && (
          <div className="h-64 border-t border-slate-800 bg-slate-900/90 flex flex-col shadow-2xl relative z-10 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950">
              <h3 className="text-sm font-semibold text-indigo-300 flex items-center">
                <Database className="w-4 h-4 mr-2" />
                {selectedNode} Details
              </h3>
              <button onClick={() => setSelectedNode(null)} className="p-1 text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex gap-6">
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Direct Dependencies</h4>
                {/* Tables this one references */}
                <div className="space-y-1">
                  {relationships.filter(r => `${r.sourceSchema}.${r.sourceTable}` === selectedNode).map(r => (
                    <div key={r.constraintName} className="text-xs bg-slate-800/50 p-2 rounded flex items-center">
                      <Link className="w-3 h-3 mr-2 text-amber-400" />
                      <span className="text-slate-300">{r.sourceColumn}</span>
                      <span className="mx-2 text-slate-500">→</span>
                      <span className="text-emerald-300">{r.targetTable}.{r.targetColumn}</span>
                    </div>
                  ))}
                  {relationships.filter(r => `${r.sourceSchema}.${r.sourceTable}` === selectedNode).length === 0 && (
                    <div className="text-xs text-slate-500 italic">No outgoing foreign keys.</div>
                  )}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Referenced By</h4>
                {/* Tables that reference this one */}
                <div className="space-y-1">
                  {relationships.filter(r => `${r.targetSchema}.${r.targetTable}` === selectedNode).map(r => (
                    <div key={r.constraintName} className="text-xs bg-slate-800/50 p-2 rounded flex items-center">
                      <Link className="w-3 h-3 mr-2 text-indigo-400" />
                      <span className="text-indigo-300">{r.sourceSchema}.{r.sourceTable}</span>
                      <span className="mx-2 text-slate-500">via</span>
                      <span className="text-slate-300">{r.sourceColumn}</span>
                    </div>
                  ))}
                  {relationships.filter(r => `${r.targetSchema}.${r.targetTable}` === selectedNode).length === 0 && (
                    <div className="text-xs text-slate-500 italic">No incoming references.</div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Columns</h4>
                {tableDetailsCache[selectedNode] ? (
                  <div className="space-y-1">
                    {tableDetailsCache[selectedNode].columns.map(c => (
                      <div key={c.name} className="text-xs flex items-center justify-between p-1.5 hover:bg-slate-800 rounded">
                        <div className="flex items-center">
                          {c.isPrimaryKey ? <Key className="w-3 h-3 mr-1.5 text-amber-400" /> : <Hash className="w-3 h-3 mr-1.5 text-slate-500" />}
                          <span className={c.isPrimaryKey ? 'text-amber-200 font-medium' : 'text-slate-300'}>{c.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{c.dataType}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 flex items-center">
                    <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> Loading columns...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
