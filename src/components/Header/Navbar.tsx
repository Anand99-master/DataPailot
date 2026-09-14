import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Sparkles,
  Shield,
  Terminal,
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
import { DataPilotLogo } from '../common/DataPilotLogo';

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
  const navContainerRef = useRef<HTMLElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(8);

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

  const navItems: Array<{
    id: 'editor' | 'analysis' | 'visualization' | 'dashboards' | 'reports' | 'data-quality' | 'cleaning' | 'lineage';
    label: string;
    icon: any;
    color: string;
    activeClass: string;
  }> = [
    { id: 'editor', label: 'SQL', icon: Code2, color: 'text-indigo-400', activeClass: 'bg-slate-800 text-white' },
    { id: 'analysis', label: 'Analysis', icon: BarChart3, color: 'text-emerald-400', activeClass: 'bg-indigo-600 text-white' },
    { id: 'visualization', label: 'Visuals', icon: PieChart, color: 'text-purple-300', activeClass: 'bg-purple-600 text-white' },
    { id: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, color: 'text-emerald-300', activeClass: 'bg-emerald-600 text-white' },
    { id: 'reports', label: 'Reports', icon: FileText, color: 'text-cyan-300', activeClass: 'bg-cyan-600 text-white' },
    { id: 'data-quality', label: 'Quality', icon: ShieldAlert, color: 'text-rose-300', activeClass: 'bg-rose-600 text-white' },
    { id: 'cleaning', label: 'Cleaning', icon: Wand2, color: 'text-cyan-300', activeClass: 'bg-cyan-600 text-white' },
    { id: 'lineage', label: 'Lineage', icon: Database, color: 'text-amber-300', activeClass: 'bg-amber-600 text-white' },
  ];

  // Measured overflow calculation using ResizeObserver
  useEffect(() => {
    const updateVisibleCount = () => {
      if (!navContainerRef.current) return;
      const width = navContainerRef.current.clientWidth;
      // Adaptive thresholds based on measured navbar available width
      if (width >= 720) {
        setVisibleCount(8);
      } else if (width >= 580) {
        setVisibleCount(6);
      } else if (width >= 460) {
        setVisibleCount(5);
      } else {
        setVisibleCount(4);
      }
    };

    updateVisibleCount();
    const observer = new ResizeObserver(() => {
      updateVisibleCount();
    });

    if (navContainerRef.current) {
      observer.observe(navContainerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const visibleItems = navItems.slice(0, visibleCount);
  const overflowItems = navItems.slice(visibleCount);
  
  // Check if active view is in overflow items
  const activeOverflowItem = overflowItems.find(item => item.id === activeView);
  const isSecondaryActive = Boolean(activeOverflowItem);

  return (
    <header
      id="workspace-navbar"
      className="h-12 max-h-12 min-h-12 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between px-2.5 text-slate-200 select-none z-30 flex-shrink-0 w-full relative"
    >
      {/* Left: Breadcrumbs & Workspace Switcher & Connection */}
      <div className="flex items-center space-x-1.5 md:space-x-2 min-w-0 flex-shrink-0">
        <div className="flex items-center flex-shrink-0">
          <DataPilotLogo variant="compact" size="sm" />
        </div>

        <div className="h-3 w-px bg-slate-800 hidden sm:block flex-shrink-0" />

        {/* Workspace & Project Selector */}
        <div className="min-w-0 flex-shrink-1">
          <WorkspaceSelector onOpenAdminConsole={onOpenAdminConsole} />
        </div>
      </div>

      {/* Center: Mode / View Switcher */}
      {onViewChange && (
        <nav
          ref={navContainerRef}
          aria-label="Workspace Views"
          className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 min-w-0 flex-shrink-1 mx-1.5 relative overflow-visible"
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                id={`tab-btn-${item.id}`}
                type="button"
                onClick={() => onViewChange(item.id)}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
                  isActive
                    ? `${item.activeClass} shadow-xs`
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${item.color} flex-shrink-0`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Responsive Overflow "More" Dropdown Menu */}
          {overflowItems.length > 0 && (
            <div
              ref={moreMenuRef}
              className="relative flex-shrink-0 ml-0.5"
              onKeyDown={(e) => {
                if (e.key === 'Escape' && isMoreMenuOpen) {
                  setIsMoreMenuOpen(false);
                }
              }}
            >
              <button
                id="tab-btn-more-views"
                type="button"
                onClick={() => setIsMoreMenuOpen(prev => !prev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsMoreMenuOpen(prev => !prev);
                  }
                }}
                className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  isSecondaryActive
                    ? 'bg-slate-800 text-emerald-300 shadow-xs border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="More views (Reports, Quality, Cleaning, Lineage)"
                aria-label="More views"
                aria-expanded={isMoreMenuOpen}
                aria-haspopup="true"
              >
                {isSecondaryActive && activeOverflowItem ? (
                  <>
                    <activeOverflowItem.icon className={`w-3.5 h-3.5 ${activeOverflowItem.color} flex-shrink-0`} />
                    <span>{activeOverflowItem.label}</span>
                  </>
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
                  className="absolute left-0 top-full mt-1 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 text-xs text-slate-200"
                  onClick={() => setIsMoreMenuOpen(false)}
                >
                  {overflowItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onViewChange(item.id)}
                        className={`w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-slate-800 transition-colors ${
                          isActive ? 'bg-slate-800 text-white font-semibold' : 'text-slate-300'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
            className={`flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors flex-shrink-0 ${
              user
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/40'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title={user ? `Signed in as ${user.email}` : 'Sign in / Authentication'}
            aria-label="User Profile"
          >
            {user ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="hidden lg:inline truncate max-w-[100px]">{user.name}</span>
                <span className="text-[10px] uppercase font-mono px-1 bg-emerald-900/50 text-emerald-300 rounded">
                  {user.role}
                </span>
              </>
            ) : (
              <>
                <UserIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="hidden lg:inline">Sign In</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
};

