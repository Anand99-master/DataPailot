import React, { useState, useRef, useEffect } from 'react';
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
  User as UserIcon,
  ChevronDown,
  MoreHorizontal
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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isConnected = Boolean(connection?.isConnected);
  const typeLabel = connection?.type
    ? connection.type === 'postgresql'
      ? 'PostgreSQL'
      : connection.type.toUpperCase()
    : '';

  // Close "More" dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isSecondaryActive = ['reports', 'data-quality', 'cleaning', 'lineage'].includes(activeView);

  const getSecondaryActiveLabel = () => {
    switch (activeView) {
      case 'reports':
        return 'Reports';
      case 'data-quality':
        return 'Quality';
      case 'cleaning':
        return 'Cleaning';
      case 'lineage':
        return 'Lineage';
      default:
        return 'More';
    }
  };

  return (
    <header
      id="workspace-navbar"
      className="h-12 max-h-12 min-h-12 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between px-2.5 text-slate-200 select-none z-30 flex-shrink-0 w-full"
    >
      {/* Left: Breadcrumbs & Workspace Switcher & Connection */}
      <div className="flex items-center space-x-1.5 md:space-x-2 min-w-0 flex-shrink-0">
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          <Terminal className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-white tracking-wide hidden sm:inline">DataPilot</span>
        </div>

        <div className="h-3 w-px bg-slate-800 hidden sm:block flex-shrink-0" />

        {/* Workspace & Project Selector */}
        <div className="min-w-0 flex-shrink-1">
          <WorkspaceSelector onOpenAdminConsole={onOpenAdminConsole} />
        </div>

        <div className="h-3 w-px bg-slate-800 hidden md:block flex-shrink-0" />

        {/* Database Connection Pill */}
        {isConnected ? (
          <div className="hidden lg:flex items-center space-x-1.5 flex-shrink-0">
            <button
              onClick={onOpenConnectModal}
              className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors truncate max-w-[160px]"
              title="View connection parameters"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span className="truncate">{typeLabel}</span>
              <span className="text-slate-400 font-mono text-[10px] truncate">({connection?.database})</span>
            </button>

            <button
              onClick={onRefreshSchema}
              disabled={isRefreshing}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
              title="Refresh Schema"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={onDisconnect}
              className="flex items-center p-1 rounded text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 transition-colors"
              title="Disconnect from database"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenConnectModal}
            className="hidden lg:flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-750 border border-slate-700/80 transition-colors flex-shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="text-slate-300 text-[11px]">No DB</span>
          </button>
        )}
      </div>

      {/* Center: Mode / View Switcher */}
      {onViewChange && (
        <nav
          aria-label="Workspace Views"
          className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 min-w-0 flex-shrink-1 mx-1.5 overflow-hidden"
        >
          {/* Primary View: SQL */}
          <button
            id="tab-btn-sql-editor"
            type="button"
            onClick={() => onViewChange('editor')}
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
              activeView === 'editor'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>SQL</span>
          </button>

          {/* Primary View: Analysis */}
          <button
            id="tab-btn-analysis-toolkit"
            type="button"
            onClick={() => onViewChange('analysis')}
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
              activeView === 'analysis'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>Analysis</span>
          </button>

          {/* Primary View: Visuals */}
          <button
            id="tab-btn-visualization"
            type="button"
            onClick={() => onViewChange('visualization')}
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
              activeView === 'visualization'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />
            <span>Visuals</span>
          </button>

          {/* Primary View: Dashboards */}
          <button
            id="tab-btn-dashboards"
            type="button"
            onClick={() => onViewChange('dashboards')}
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
              activeView === 'dashboards'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
            <span>Dashboards</span>
          </button>

          {/* Secondary Views (Always visible on large screens, or cleanly accessible) */}
          <button
            id="tab-btn-reports"
            type="button"
            onClick={() => onViewChange('reports')}
            className={`hidden xl:flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
              activeView === 'reports'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
            <span>Reports</span>
          </button>

          <button
            id="tab-btn-data-quality"
            type="button"
            onClick={() => onViewChange('data-quality')}
            className={`hidden xl:flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
              activeView === 'data-quality'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-300 flex-shrink-0" />
            <span>Quality</span>
          </button>

          <button
            id="tab-btn-cleaning"
            type="button"
            onClick={() => onViewChange('cleaning')}
            className={`hidden 2xl:flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
              activeView === 'cleaning'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
            <span>Cleaning</span>
          </button>

          <button
            id="tab-btn-lineage"
            type="button"
            onClick={() => onViewChange('lineage')}
            className={`hidden 2xl:flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
              activeView === 'lineage'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
            <span>Lineage</span>
          </button>

          {/* Responsive Overflow "More" Dropdown Menu for Viewports < 2xl */}
          <div ref={moreMenuRef} className="relative 2xl:hidden flex-shrink-0">
            <button
              id="tab-btn-more-views"
              type="button"
              onClick={() => setIsMoreMenuOpen(prev => !prev)}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                isSecondaryActive
                  ? 'bg-slate-800 text-emerald-300 shadow-xs border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="More views (Reports, Quality, Cleaning, Lineage)"
              aria-label="More views"
            >
              {isSecondaryActive ? (
                <span>{getSecondaryActiveLabel()}</span>
              ) : (
                <>
                  <MoreHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">More</span>
                </>
              )}
              <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
            </button>

            {isMoreMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1 w-44 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1 z-50 text-xs text-slate-200"
                onClick={() => setIsMoreMenuOpen(false)}
              >
                <button
                  onClick={() => onViewChange('reports')}
                  className={`w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-slate-800 transition-colors ${
                    activeView === 'reports' ? 'bg-cyan-950/60 text-cyan-300 font-semibold' : 'text-slate-300'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Reports</span>
                </button>

                <button
                  onClick={() => onViewChange('data-quality')}
                  className={`w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-slate-800 transition-colors ${
                    activeView === 'data-quality' ? 'bg-rose-950/60 text-rose-300 font-semibold' : 'text-slate-300'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
                  <span>Data Quality</span>
                </button>

                <button
                  onClick={() => onViewChange('cleaning')}
                  className={`w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-slate-800 transition-colors ${
                    activeView === 'cleaning' ? 'bg-cyan-950/60 text-cyan-300 font-semibold' : 'text-slate-300'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Data Cleaning</span>
                </button>

                <button
                  onClick={() => onViewChange('lineage')}
                  className={`w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-slate-800 transition-colors ${
                    activeView === 'lineage' ? 'bg-amber-950/60 text-amber-300 font-semibold' : 'text-slate-300'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-amber-300" />
                  <span>Data Lineage</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Right: Search, Activity, Notifications, Import, AI & Auth Controls */}
      <div className="flex items-center space-x-1.5 md:space-x-2 flex-shrink-0">
        {/* Global Search Button */}
        {onOpenSearch && (
          <button
            id="btn-global-search"
            type="button"
            onClick={onOpenSearch}
            className="flex items-center space-x-1 px-1.5 md:px-2 py-1 rounded-lg text-xs bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
            title="Search workspace (Cmd+K)"
            aria-label="Search Workspace"
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden 2xl:inline text-[11px]">Search</span>
            <kbd className="hidden lg:inline-block text-[9px] font-mono px-1 bg-slate-800 text-slate-400 rounded border border-slate-700">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Activity Feed Button */}
        {onOpenActivityFeed && (
          <button
            id="btn-activity-feed"
            type="button"
            onClick={onOpenActivityFeed}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
            title="Workspace Activity Feed"
            aria-label="Activity Feed"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        )}

        {/* Notifications Popover */}
        <div className="flex-shrink-0">
          <NotificationsPopover />
        </div>

        {/* Import Data Modal Trigger */}
        {onOpenImportModal && (
          <button
            id="btn-navbar-import-data"
            type="button"
            onClick={onOpenImportModal}
            className="hidden md:flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-colors shadow-xs flex-shrink-0"
            title="Import CSV, Excel, or JSON data file"
            aria-label="Import Data"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="hidden lg:inline">Import</span>
          </button>
        )}

        {/* AI Assistant Button */}
        <button
          id="btn-navbar-ai-assistant"
          type="button"
          onClick={onToggleAiPanel}
          className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors flex-shrink-0 ${
            isAiPanelOpen
              ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
              : 'bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title="Toggle AI Data Assistant panel"
          aria-label="Toggle AI Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span className="hidden xl:inline">AI Assistant</span>
        </button>

        {/* User Account / Profile Button */}
        {onOpenAuthModal && (
          <button
            id="btn-user-profile"
            type="button"
            onClick={onOpenAuthModal}
            className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs transition-colors flex-shrink-0"
            title="User Profile & Settings"
            aria-label="User Profile"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center font-bold text-[10px] text-emerald-300 flex-shrink-0">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <span className="hidden xl:inline max-w-[80px] truncate">{user?.name || 'Account'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
