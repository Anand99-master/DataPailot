import React, { useState } from 'react';
import {
  Database,
  RefreshCw,
  Plus,
  Key,
  Link2,
  ChevronRight,
  ChevronDown,
  Layers,
  Server,
  LogOut,
  Table as TableIcon,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  FileCode,
  Upload,
  Sparkles
} from 'lucide-react';
import {
  DiscoveredTable,
  SanitizedConnectionInfo,
  TableDetailsResult
} from '../../types/database';
import { ImportedDataset } from '../../types/import';
import { TableDetailsPanel } from './TableDetailsPanel';

interface DatabaseExplorerProps {
  connection: SanitizedConnectionInfo | null;
  tables: DiscoveredTable[];
  importedDatasets?: ImportedDataset[];
  selectedTable: TableDetailsResult | null;
  isLoadingTableDetails: boolean;
  onSelectTable: (table: DiscoveredTable) => void;
  onCloseTableDetails: () => void;
  onRefreshSchema: () => void;
  isRefreshing: boolean;
  refreshMessage?: string | null;
  onOpenConnectModal: () => void;
  onOpenImportModal?: () => void;
  onInspectDataset?: (dataset: ImportedDataset) => void;
  onDisconnect: () => void;
  onInsertColumnToQuery: (columnIdentifier: string) => void;
  selectedSchema?: string;
  onSelectSchema?: (schema: string) => void;
}

export const DatabaseExplorer: React.FC<DatabaseExplorerProps> = ({
  connection,
  tables,
  importedDatasets = [],
  selectedTable,
  isLoadingTableDetails,
  onSelectTable,
  onCloseTableDetails,
  onRefreshSchema,
  isRefreshing,
  refreshMessage,
  onOpenConnectModal,
  onOpenImportModal,
  onInspectDataset,
  onDisconnect,
  onInsertColumnToQuery
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const dbTables = tables.filter(t => t.schema !== 'imported');

  const filteredTables = dbTables.filter(t =>
    t.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    t.schema.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredDatasets = importedDatasets.filter(d =>
    d.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    d.tableName.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'CSV':
        return <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'XLSX':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
      case 'JSON':
        return <FileCode className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
      default:
        return <TableIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />;
    }
  };

  return (
    <aside
      id="database-explorer-sidebar"
      className="w-72 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none text-slate-200"
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-sm tracking-tight text-white">DataPilot</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                Workspace
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">SQL &amp; AI Analysis</p>
          </div>
        </div>
      </div>

      {/* Database Connection Section */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            Connection
          </span>
          {connection?.isConnected ? (
            <button
              id="btn-disconnect-db"
              onClick={onDisconnect}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-rose-950/40 transition-colors"
              title="Disconnect database"
            >
              <LogOut className="w-3 h-3" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              id="btn-add-connection"
              onClick={onOpenConnectModal}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
              title="Configure connection"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect</span>
            </button>
          )}
        </div>

        {connection?.isConnected ? (
          <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="text-xs font-semibold text-white truncate">
                  {connection.database}
                </span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded font-mono uppercase">
                {connection.type}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span className="truncate">{connection.username}@{connection.host}:{connection.port}</span>
              {connection.ssl && <span className="text-emerald-400 text-[9px]">SSL</span>}
            </div>
          </div>
        ) : (
          <button
            id="btn-quick-connect"
            onClick={onOpenConnectModal}
            className="w-full text-left p-2.5 rounded-lg border border-dashed border-slate-700 hover:border-slate-500 bg-slate-800/20 hover:bg-slate-800/40 text-xs text-slate-400 flex items-center justify-between group transition-all"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400/80" />
              <span>No Database Connected</span>
            </span>
            <span className="text-xs font-semibold text-emerald-400 group-hover:underline">Connect</span>
          </button>
        )}
      </div>

      {/* Tables Section Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-800/60 bg-slate-900/50">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Tables {connection?.isConnected && `(${dbTables.length})`}
          </span>
        </div>
        <button
          id="btn-refresh-schema"
          onClick={onRefreshSchema}
          disabled={isRefreshing || !connection?.isConnected}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors disabled:opacity-40"
          title="Refresh database schema and introspect newly added tables"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span className="text-[11px]">{isRefreshing ? 'Refreshing...' : 'Refresh Schema'}</span>
        </button>
      </div>

      {/* Refresh Schema Notification Banner */}
      {refreshMessage && (
        <div className="px-3 py-1.5 bg-emerald-950/40 border-b border-emerald-900/40 text-[11px] text-emerald-300 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="truncate">{refreshMessage}</span>
        </div>
      )}

      {/* Filter / Search input when tables or datasets exist */}
      {(dbTables.length > 5 || importedDatasets.length > 3) && (
        <div className="p-2 border-b border-slate-800/60">
          <input
            type="text"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder="Filter tables & datasets..."
            className="w-full px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded text-slate-300 placeholder-slate-600 focus:outline-hidden focus:border-slate-600 font-mono"
          />
        </div>
      )}

      {/* Explorer Body: Discovered Tables and Imported Datasets */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {/* Imported Datasets Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Upload className="w-3 h-3 text-emerald-400" />
              <span>Imported Datasets ({importedDatasets.length})</span>
            </span>
            {onOpenImportModal && (
              <button
                id="btn-sidebar-import-data"
                onClick={onOpenImportModal}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-emerald-950/40 border border-emerald-500/20 transition-colors"
                title="Import CSV, XLSX or JSON"
              >
                <Plus className="w-3 h-3" />
                <span>Import</span>
              </button>
            )}
          </div>

          {importedDatasets.length === 0 ? (
            <div className="px-2 py-2 text-center border border-dashed border-slate-800 rounded-lg bg-slate-950/30">
              <p className="text-[11px] text-slate-500">No imported files yet</p>
              {onOpenImportModal && (
                <button
                  onClick={onOpenImportModal}
                  className="mt-1 text-xs text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Import CSV / Excel / JSON</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredDatasets.map(ds => {
                const isSelected = selectedTable?.name === ds.tableName;
                return (
                  <div
                    key={ds.datasetId}
                    onClick={() =>
                      onSelectTable({
                        schema: 'imported',
                        name: ds.tableName,
                        type: 'TABLE',
                        approximateRowCount: ds.rowCount
                      })
                    }
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-colors border group ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-semibold'
                        : 'border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {getFileTypeIcon(ds.fileType)}
                      <div className="truncate">
                        <div className="truncate font-medium">{ds.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          {ds.tableName} • {ds.rowCount} rows
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      {onInspectDataset && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onInspectDataset(ds);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="View Dataset Details & Profile"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Database Tables Section */}
        <div>
          <div className="px-2 py-1 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Database className="w-3 h-3 text-slate-400" />
            <span>Database Tables</span>
          </div>

          {!connection?.isConnected ? (
            <div
              id="empty-table-explorer"
              className="p-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/20 text-center"
            >
              <p className="text-xs text-slate-400 mb-2">No database connected</p>
              <button
                id="btn-connect-database-empty"
                onClick={onOpenConnectModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Connect Database</span>
              </button>
            </div>
          ) : dbTables.length === 0 ? (
            <div className="p-3 text-center text-slate-500 text-xs">
              No tables found in schema
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTables.map(table => {
                const isSelected = selectedTable?.name === table.name && selectedTable?.schema === table.schema;

                return (
                  <div
                    key={`${table.schema}.${table.name}`}
                    onClick={() => onSelectTable(table)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer text-xs font-medium transition-colors border ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-semibold'
                        : 'border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {table.type === 'VIEW' ? (
                        <span title="View" className="flex items-center"><Eye className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" /></span>
                      ) : (
                        <span title="Table" className="flex items-center"><TableIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /></span>
                      )}
                      <span className="truncate font-mono">{table.name}</span>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0 text-[10px] font-mono text-slate-500">
                      {table.schema !== 'public' && (
                        <span className="text-slate-500">{table.schema}</span>
                      )}
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Table Details Drawer Panel */}
      <TableDetailsPanel
        tableDetails={selectedTable}
        isLoading={isLoadingTableDetails}
        onClose={onCloseTableDetails}
        onInsertColumnToQuery={onInsertColumnToQuery}
        onSelectReferencedTable={(schema, targetTable) => {
          const match = tables.find(t => t.schema === schema && t.name === targetTable);
          if (match) {
            onSelectTable(match);
          }
        }}
      />
    </aside>
  );
};
