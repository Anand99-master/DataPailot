import React from 'react';
import { Database, Sparkles, Shield, Terminal, LogOut, RefreshCw, Code2, BarChart3, PieChart, LayoutDashboard, Upload, ShieldAlert, Wand2 } from 'lucide-react';
import { SanitizedConnectionInfo } from '../../types/database';

interface NavbarProps {
  connection: SanitizedConnectionInfo | null;
  onOpenConnectModal: () => void;
  onOpenImportModal?: () => void;
  onDisconnect: () => void;
  onRefreshSchema: () => void;
  isRefreshing: boolean;
  isAiPanelOpen: boolean;
  onToggleAiPanel: () => void;
  activeView?: 'editor' | 'analysis' | 'visualization' | 'dashboards' | 'lineage' | 'data-quality' | 'cleaning';
  onViewChange?: (view: 'editor' | 'analysis' | 'visualization' | 'dashboards' | 'lineage' | 'data-quality' | 'cleaning') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  connection,
  onOpenConnectModal,
  onOpenImportModal,
  onDisconnect,
  onRefreshSchema,
  isRefreshing,
  isAiPanelOpen,
  onToggleAiPanel,
  activeView = 'editor',
  onViewChange
}) => {
  const isConnected = Boolean(connection?.isConnected);
  const typeLabel = connection?.type
    ? connection.type === 'postgresql'
      ? 'PostgreSQL'
      : connection.type.toUpperCase()
    : '';

  return (
    <header
      id="workspace-navbar"
      className="h-12 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between px-4 text-slate-200 select-none z-20 flex-shrink-0"
    >
      {/* Left: Breadcrumbs & Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white tracking-wide">DataPilot</span>
          <span className="text-slate-600 text-xs">/</span>
          <span className="text-xs text-slate-400 font-medium">Workspace</span>
        </div>

        <div className="h-3 w-px bg-slate-800" />

        {/* Database Connection Pill */}
        {isConnected ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenConnectModal}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              title="View connection parameters"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{typeLabel} Connected</span>
              <span className="text-slate-400 font-mono text-[11px]">({connection?.database})</span>
            </button>

            <button
              onClick={onRefreshSchema}
              disabled={isRefreshing}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
              title="Refresh Schema"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={onDisconnect}
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 transition-colors"
              title="Disconnect from database"
            >
              <LogOut className="w-3 h-3" />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenConnectModal}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-750 border border-slate-700/80 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-300">No Database Connected</span>
          </button>
        )}
      </div>

      {/* Center: Mode / View Switcher */}
      {onViewChange && (
        <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
          <button
            id="tab-btn-sql-editor"
            onClick={() => onViewChange('editor')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'editor'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>SQL Editor</span>
          </button>

          <button
            id="tab-btn-analysis-toolkit"
            onClick={() => onViewChange('analysis')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'analysis'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Analysis Toolkit</span>
          </button>

          <button
            id="tab-btn-visualization"
            onClick={() => onViewChange('visualization')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'visualization'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-purple-300" />
            <span>Visualization</span>
          </button>

          <button
            id="tab-btn-lineage"
            onClick={() => onViewChange('lineage')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'lineage'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-amber-300" />
            <span>Lineage</span>
          </button>

          <button
            id="tab-btn-dashboards"
            onClick={() => onViewChange && onViewChange('dashboards')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'dashboards'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-emerald-300" />
            <span>Dashboards</span>
          </button>

          <button
            id="tab-btn-data-quality"
            onClick={() => onViewChange && onViewChange('data-quality')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'data-quality'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
            <span>Data Quality</span>
          </button>

          <button
            id="tab-btn-cleaning"
            onClick={() => onViewChange && onViewChange('cleaning')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'cleaning'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-cyan-300" />
            <span>Data Cleaning</span>
          </button>
        </div>
      )}

      {/* Right: Security & Action Controls */}
      <div className="flex items-center space-x-3">
        {onOpenImportModal && (
          <button
            id="btn-navbar-import-data"
            onClick={onOpenImportModal}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-colors shadow-xs"
            title="Import CSV, Excel, or JSON data file"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import Data</span>
          </button>
        )}

        <div className="hidden md:flex items-center space-x-1 text-[11px] text-slate-400 bg-slate-850 px-2.5 py-1 rounded border border-slate-800">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span>Server Read-Only Guard</span>
        </div>

        <button
          onClick={onToggleAiPanel}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
            isAiPanelOpen
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
              : 'bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title="Toggle AI Data Assistant panel"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI Assistant</span>
        </button>
      </div>
    </header>
  );
};
