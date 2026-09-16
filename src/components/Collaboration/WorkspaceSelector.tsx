import React, { useState, useRef, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { CollaborationApiClient } from '../../services/collaborationApi';
import {
  Building2,
  FolderKanban,
  ChevronDown,
  Plus,
  Check,
  Users,
  Settings,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';

interface WorkspaceSelectorProps {
  onOpenAdminConsole?: () => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ onOpenAdminConsole }) => {
  const {
    activeWorkspace,
    workspaces,
    activeProject,
    projects,
    role,
    can,
    switchWorkspace,
    switchProject,
    refreshWorkspaces,
    refreshProjects
  } = useCollaboration();

  const [isWsDropdownOpen, setIsWsDropdownOpen] = useState(false);
  const [isProjDropdownOpen, setIsProjDropdownOpen] = useState(false);
  const [isNewWsModalOpen, setIsNewWsModalOpen] = useState(false);
  const [isNewProjModalOpen, setIsNewProjModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside or pressing ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsWsDropdownOpen(false);
        setIsProjDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsWsDropdownOpen(false);
        setIsProjDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // New Workspace form state
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [isCreatingWs, setIsCreatingWs] = useState(false);

  // New Project form state
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [isCreatingProj, setIsCreatingProj] = useState(false);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setIsCreatingWs(true);
    const res = await CollaborationApiClient.createWorkspace(newWsName.trim(), newWsDesc.trim());
    setIsCreatingWs(false);
    if (res.success && res.workspace) {
      await refreshWorkspaces();
      await switchWorkspace(res.workspace.id);
      setIsNewWsModalOpen(false);
      setNewWsName('');
      setNewWsDesc('');
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    setIsCreatingProj(true);
    const res = await CollaborationApiClient.createProject(newProjName.trim(), newProjDesc.trim());
    setIsCreatingProj(false);
    if (res.success && res.project) {
      await refreshProjects();
      switchProject(res.project.id);
      setIsNewProjModalOpen(false);
      setNewProjName('');
      setNewProjDesc('');
    }
  };

  return (
    <div ref={containerRef} className="flex items-center space-x-2 text-xs relative">
      {/* Workspace Switcher */}
      <div className="relative">
        <button
          id="btn-workspace-switcher"
          onClick={() => {
            setIsWsDropdownOpen(!isWsDropdownOpen);
            setIsProjDropdownOpen(false);
          }}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-200 transition-colors"
          title="Switch active workspace"
        >
          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-semibold text-white max-w-[120px] truncate">
            {activeWorkspace?.name || 'Primary Workspace'}
          </span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {role}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {isWsDropdownOpen && (
          <div
            className="absolute left-0 mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 text-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
              <span>Workspaces</span>
              <button
                onClick={() => {
                  setIsWsDropdownOpen(false);
                  setIsNewWsModalOpen(true);
                }}
                className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-0.5 normal-case font-medium"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto py-1">
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => {
                    switchWorkspace(ws.id);
                    setIsWsDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-800 transition-colors text-xs ${
                    activeWorkspace?.id === ws.id ? 'bg-indigo-500/10 text-indigo-300 font-medium' : 'text-slate-300'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="font-medium text-white truncate">{ws.name}</div>
                    {ws.description && <div className="text-[10px] text-slate-400 truncate">{ws.description}</div>}
                  </div>
                  {activeWorkspace?.id === ws.id && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                </button>
              ))}
            </div>

            {onOpenAdminConsole && can('workspace.manage_members') && (
              <div className="pt-1 border-t border-slate-800 px-1">
                <button
                  onClick={() => {
                    setIsWsDropdownOpen(false);
                    onOpenAdminConsole();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center space-x-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Workspace Settings & RBAC</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Switcher */}
      <div className="relative">
        <button
          id="btn-project-switcher"
          data-testid="btn-project-switcher"
          onClick={() => {
            setIsProjDropdownOpen(!isProjDropdownOpen);
            setIsWsDropdownOpen(false);
          }}
          className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 transition-colors"
          title="Filter by Project"
        >
          <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
          <span id="active-project-name" data-testid="active-project-name" className="max-w-[110px] truncate">
            {activeProject ? activeProject.name : 'All Projects'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {isProjDropdownOpen && (
          <div
            id="dropdown-project-list"
            className="absolute left-0 mt-1.5 w-60 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 text-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
              <span>Projects</span>
              <button
                id="btn-new-project-open"
                onClick={() => {
                  setIsProjDropdownOpen(false);
                  setIsNewProjModalOpen(true);
                }}
                className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-0.5 normal-case font-medium"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto py-1">
              <button
                id="project-option-all"
                data-testid="project-option-all"
                onClick={() => {
                  switchProject(null);
                  setIsProjDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 transition-colors text-xs ${
                  !activeProject ? 'bg-emerald-500/10 text-emerald-300 font-medium' : 'text-slate-300'
                }`}
              >
                <span>All Projects (Workspace Wide)</span>
                {!activeProject && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
              </button>

              {projects.map(p => (
                <button
                  key={p.id}
                  id={`project-option-${p.id}`}
                  data-testid={`project-option-${p.id}`}
                  data-project-id={p.id}
                  data-project-name={p.name}
                  onClick={() => {
                    switchProject(p.id);
                    setIsProjDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 transition-colors text-xs ${
                    activeProject?.id === p.id ? 'bg-emerald-500/10 text-emerald-300 font-medium' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate pr-2">{p.name}</span>
                  {activeProject?.id === p.id && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Workspace Modal */}
      {isNewWsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Create New Workspace</span>
            </h3>
            <form onSubmit={handleCreateWorkspace} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Workspace Name</label>
                <input
                  type="text"
                  required
                  value={newWsName}
                  onChange={e => setNewWsName(e.target.value)}
                  placeholder="e.g. Growth & Marketing Analytics"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description (Optional)</label>
                <textarea
                  value={newWsDesc}
                  onChange={e => setNewWsDesc(e.target.value)}
                  placeholder="Workspace scope and domain..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewWsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWs}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  {isCreatingWs ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {isNewProjModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <FolderKanban className="w-4 h-4 text-emerald-400" />
              <span>Create New Project</span>
            </h3>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  placeholder="e.g. Q4 Executive KPIs"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description (Optional)</label>
                <textarea
                  value={newProjDesc}
                  onChange={e => setNewProjDesc(e.target.value)}
                  placeholder="Project purpose, datasets, and objectives..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500 resize-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProj}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  {isCreatingProj ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
