import React, { useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { X, Activity, RefreshCw, Database, FileText, LayoutDashboard, UserCheck, Shield, Sparkles } from 'lucide-react';

interface ActivityFeedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityFeedDrawer: React.FC<ActivityFeedDrawerProps> = ({ isOpen, onClose }) => {
  const { activities, refreshActivities, activeWorkspace } = useCollaboration();

  useEffect(() => {
    if (isOpen) {
      refreshActivities();
    }
  }, [isOpen, refreshActivities]);

  if (!isOpen) return null;

  const getActionBadge = (action: string) => {
    if (action.includes('QUERY')) return { label: 'SQL Query', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' };
    if (action.includes('DASHBOARD')) return { label: 'Dashboard', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
    if (action.includes('REPORT')) return { label: 'Report', color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' };
    if (action.includes('MEMBER') || action.includes('ROLE')) return { label: 'Member / RBAC', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
    if (action.includes('DATASET') || action.includes('IMPORT')) return { label: 'Dataset', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' };
    return { label: 'Workspace', color: 'bg-slate-700/30 text-slate-300 border-slate-700/50' };
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col text-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Workspace Activity Feed</h3>
              <p className="text-xs text-slate-400">
                {activeWorkspace?.name || 'Primary Workspace'} &bull; Real-time audit
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => refreshActivities()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh activity"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Activity Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-800/40">
          {activities.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No recent activity recorded in this workspace.
            </div>
          ) : (
            activities.map(act => {
              const badge = getActionBadge(act.action);
              return (
                <div key={act.id} className="pt-3 first:pt-0 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white flex items-center space-x-1.5">
                      <span>{act.actorName}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(act.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-slate-300 font-medium">
                    {act.action.replace(/_/g, ' ')}
                    {act.resourceName && (
                      <span className="text-emerald-400 ml-1 font-mono text-[11px]">
                        "{act.resourceName}"
                      </span>
                    )}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
