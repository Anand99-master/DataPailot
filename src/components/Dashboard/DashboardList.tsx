import React, { useState } from 'react';
import {
  LayoutDashboard,
  Plus,
  Search,
  SlidersHorizontal,
  Clock,
  Sparkles,
  Layers,
  Copy,
  Trash2,
  Edit2,
  ArrowRight,
  ExternalLink,
  Calendar,
  Grid
} from 'lucide-react';
import { Dashboard } from '../../types/dashboard';

interface DashboardListProps {
  dashboards: Dashboard[];
  onOpenDashboard: (dashboardId: string) => void;
  onCreateNew: () => void;
  onOpenTemplates: () => void;
  onOpenAiBuilder: () => void;
  onDuplicate: (dashboardId: string) => void;
  onDelete: (dashboardId: string) => void;
  onRename: (dashboardId: string, currentName: string) => void;
}

export const DashboardList: React.FC<DashboardListProps> = ({
  dashboards,
  onOpenDashboard,
  onCreateNew,
  onOpenTemplates,
  onOpenAiBuilder,
  onDuplicate,
  onDelete,
  onRename
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'widgets'>('updated');

  const filtered = dashboards
    .filter(d => {
      const q = searchTerm.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'widgets') return b.widgets.length - a.widgets.length;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-y-auto">
      {/* Top Banner / Hero */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-8 py-7">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Analytics Dashboards
              </h1>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Construct multi-widget executive dashboards with live PostgreSQL queries, safe parameterized filters, and grounded AI insights.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenTemplates}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-medium border border-slate-700/60 transition-colors"
            >
              <Grid className="w-3.5 h-3.5 text-indigo-400" />
              <span>Templates</span>
            </button>

            <button
              type="button"
              onClick={onOpenAiBuilder}
              className="flex items-center space-x-1.5 px-3 py-2 bg-purple-950/40 hover:bg-purple-900/60 text-purple-200 hover:text-white rounded-xl text-xs font-medium border border-purple-800/60 transition-colors shadow-lg shadow-purple-950/20"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Build with AI</span>
            </button>

            <button
              type="button"
              onClick={onCreateNew}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-emerald-950"
            >
              <Plus className="w-4 h-4" />
              <span>New Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-8 py-6 space-y-6">
        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dashboards by name or description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="updated">Recently Updated</option>
              <option value="name">Dashboard Name</option>
              <option value="widgets">Widget Count</option>
            </select>
          </div>
        </div>

        {/* Dashboard Grid or Empty State */}
        {dashboards.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <LayoutDashboard className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">No Dashboards Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Start by creating an empty dashboard, launch with a verified starter template, or ask AI to design one from your schema.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={onCreateNew}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors"
              >
                Create Blank Dashboard
              </button>
              <button
                type="button"
                onClick={onOpenTemplates}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors"
              >
                Browse Templates
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No dashboards match "{searchTerm}". Try adjusting your search query.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(dash => {
              const updatedDate = new Date(dash.updatedAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div
                  key={dash.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-black/40 group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3
                        onClick={() => onOpenDashboard(dash.id)}
                        className="text-sm font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors cursor-pointer line-clamp-1"
                        title={dash.name}
                      >
                        {dash.name}
                      </h3>

                      <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => onRename(dash.id, dash.name)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                          title="Rename dashboard"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicate(dash.id)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                          title="Duplicate dashboard"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(dash.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                          title="Delete dashboard"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] mb-4">
                      {dash.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 mb-4 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center space-x-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{dash.widgets.length} widgets</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Updated {updatedDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-slate-400">
                      {dash.filters.length} filters
                    </span>

                    <button
                      type="button"
                      onClick={() => onOpenDashboard(dash.id)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 group-hover:bg-emerald-600 text-slate-200 group-hover:text-white rounded-lg text-xs font-medium transition-all"
                    >
                      <span>Open Canvas</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
