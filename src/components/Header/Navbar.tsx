import React from 'react';
import {
  Database,
  Sparkles,
  Shield,
  Terminal,
  LogOut,
  RefreshCw,
  Code2,
  BarChart3,
  PieChart,
  LayoutDashboard,
  Upload,
  ShieldAlert,
  Wand2,
  FileText,
  Search,
  Activity,
  User as UserIcon
} from 'lucide-react';
import { SanitizedConnectionInfo } from '../../types/database';
import { WorkspaceSelector } from '../Collaboration/WorkspaceSelector';
import { NotificationsPopover } from '../Collaboration/NotificationsPopover';
import { useCollaboration } from '../../context/CollaborationContext';

interface NavbarProps {
  connection: SanitizedConnectionInfo | null;
  onOpenConnectModal: () => void;
  onOpenImportModal?: () => void;
  onDisconnect: () => void;
  onRefreshSchema: () => void;
  isRefreshing: boolean;
  isAiPanelOpen: boolean;
  onToggleAiPanel: () => void;
  activeView?: 'editor' | 'analysis' | 'visualization' | 'dashboards' | 'lineage' | 'data-quality' | 'cleaning' | 'reports';
  onViewChange?: (view: 'editor' | 'analysis' | 'visualization' | 'dashboards' | 'lineage' | 'data-quality' | 'cleaning' | 'reports') => void;
  onOpenAuthModal?: () => void;
  onOpenAdminConsole?: () => void;
  onOpenActivityFeed?: () => void;
  onOpenSearch?: () => void;
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
  onViewChange,
  onOpenAuthModal,
  onOpenAdminConsole,
  onOpenActivityFeed,
  onOpenSearch
}) => {
  const { user } = useCollaboration();
  const isConnected = Boolean(connection?.isConnected);
  const typeLabel = connection?.type
    ? connection.type === 'postgresql'
      ? 'PostgreSQL'
      : connection.type.toUpperCase()
    : '';

  return (
    <header
      id="workspace-navbar"
      className="h-12 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between px-3 text-slate-200 select-none z-20 flex-shrink-0"
    >
      {/* Left: Breadcrumbs & Workspace Switcher & Connection */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-1.5">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white tracking-wide">DataPilot</span>
        </div>

        <div className="h-3 w-px bg-slate-800" />

        {/* Workspace & Project Selector */}
        <WorkspaceSelector onOpenAdminConsole={onOpenAdminConsole} />

        <div className="h-3 w-px bg-slate-800" />

        {/* Database Connection Pill */}
        {isConnected ? (
          <div className="flex items-center space-x-1.5">
            <button
              onClick={onOpenConnectModal}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              title="View connection parameters"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{typeLabel}</span>
              <span className="text-slate-400 font-mono text-[10px]">({connection?.database})</span>
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
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 transition-colors"
              title="Disconnect from database"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenConnectModal}
            className="flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-750 border border-slate-700/80 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-300">No DB</span>
          </button>
        )}
      </div>

      {/* Center: Mode / View Switcher */}
      {onViewChange && (
        <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 overflow-x-auto">
          <button
            id="tab-btn-sql-editor"
            onClick={() => onViewChange('editor')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'editor'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>SQL</span>
          </button>

          <button
            id="tab-btn-analysis-toolkit"
            onClick={() => onViewChange('analysis')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'analysis'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Analysis</span>
          </button>

          <button
            id="tab-btn-visualization"
            onClick={() => onViewChange('visualization')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'visualization'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-purple-300" />
            <span>Visuals</span>
          </button>

          <button
            id="tab-btn-dashboards"
            onClick={() => onViewChange('dashboards')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'dashboards'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-emerald-300" />
            <span>Dashboards</span>
          </button>

          <button
            id="tab-btn-reports"
            onClick={() => onViewChange('reports')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'reports'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-cyan-300" />
            <span>Reports</span>
          </button>

          <button
            id="tab-btn-data-quality"
            onClick={() => onViewChange('data-quality')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'data-quality'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
            <span>Quality</span>
          </button>

          <button
            id="tab-btn-cleaning"
            onClick={() => onViewChange('cleaning')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'cleaning'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-cyan-300" />
            <span>Cleaning</span>
          </button>

          <button
            id="tab-btn-lineage"
            onClick={() => onViewChange('lineage')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeView === 'lineage'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-amber-300" />
            <span>Lineage</span>
          </button>
        </div>
      )}

      {/* Right: Search, Activity, Notifications, Import, AI & Auth Controls */}
      <div className="flex items-center space-x-2">
        {/* Global Search Button */}
        {onOpenSearch && (
          <button
            id="btn-global-search"
            onClick={onOpenSearch}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-400 hover:text-slate-200 transition-colors"
            title="Search workspace (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">Search</span>
            <kbd className="hidden md:inline-block text-[9px] font-mono px-1 bg-slate-800 text-slate-400 rounded border border-slate-700">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Activity Feed Button */}
        {onOpenActivityFeed && (
          <button
            id="btn-activity-feed"
            onClick={onOpenActivityFeed}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Workspace Activity Feed"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
          </button>
        )}

        {/* Notifications Popover */}
        <NotificationsPopover />

        {/* Import Data Modal Trigger */}
        {onOpenImportModal && (
          <button
            id="btn-navbar-import-data"
            onClick={onOpenImportModal}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-colors shadow-xs"
            title="Import CSV, Excel, or JSON data file"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import</span>
          </button>
        )}

        {/* AI Assistant Button */}
        <button
          onClick={onToggleAiPanel}
          className={`flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
            isAiPanelOpen
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
              : 'bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title="Toggle AI Data Assistant panel"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden lg:inline">AI Assistant</span>
        </button>

        {/* User Account / Profile Button */}
        {onOpenAuthModal && (
          <button
            id="btn-user-profile"
            onClick={onOpenAuthModal}
            className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs transition-colors"
            title="User Profile & Settings"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center font-bold text-[10px] text-emerald-300">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:inline max-w-[80px] truncate">{user?.name || 'Account'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
