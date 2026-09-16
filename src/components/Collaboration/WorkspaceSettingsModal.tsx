import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { CollaborationApiClient } from '../../services/collaborationApi';
import { WorkspaceMember, UserRole, AuditLogEntry } from '../../types/collaboration';
import {
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSIONS_MAP,
  ROLE_METADATA
} from '../../constants/permissions';
import { ErrorBoundary } from '../common/ErrorBoundary';
import {
  X,
  Users,
  Shield,
  Settings,
  FolderEdit,
  Archive,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Check,
  Minus,
  Info,
  Loader2,
  FileText,
  UserX,
  AlertTriangle
} from 'lucide-react';

export type WorkspaceSettingsTab = 'general' | 'rename' | 'archive' | 'members' | 'permissions' | 'audit';

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: WorkspaceSettingsTab;
}

// Safe helpers to prevent any undefined property access
const getMemberName = (m: WorkspaceMember | null | undefined): string => {
  if (!m) return 'Teammate';
  return m.userName || m.user?.name || (m.userEmail ? m.userEmail.split('@')[0] : (m.user?.email ? m.user?.email.split('@')[0] : 'Teammate'));
};

const getMemberEmail = (m: WorkspaceMember | null | undefined): string => {
  if (!m) return '';
  return m.userEmail || m.user?.email || '';
};

const getMemberInitial = (m: WorkspaceMember | null | undefined): string => {
  const name = getMemberName(m);
  if (name && name.trim().length > 0) return name.trim().charAt(0).toUpperCase();
  const email = getMemberEmail(m);
  if (email && email.trim().length > 0) return email.trim().charAt(0).toUpperCase();
  return 'U';
};

const getRoleMeta = (r: UserRole | string | undefined) => {
  if (r && ROLE_METADATA[r as UserRole]) {
    return ROLE_METADATA[r as UserRole];
  }
  return {
    label: (r as string) || 'MEMBER',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    description: 'Workspace collaborator'
  };
};

export const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'general'
}) => {
  const { activeWorkspace, role, refreshWorkspaces, projects, can } = useCollaboration();
  const [activeTab, setActiveTab] = useState<WorkspaceSettingsTab>(initialTab);

  // Rename Workspace Form
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [isUpdatingWorkspace, setIsUpdatingWorkspace] = useState(false);

  // Archive Workspace Form
  const [archiveConfirmName, setArchiveConfirmName] = useState('');
  const [isArchivingWorkspace, setIsArchivingWorkspace] = useState(false);

  // Members State
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('ANALYST');
  const [isInviting, setIsInviting] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Member removal modal state
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // Role Permissions Matrix Filter
  const [permissionSearch, setPermissionSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterResult, setAuditFilterResult] = useState('');
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Feedback messages
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setStatusMsg(null);
      if (activeWorkspace) {
        setWorkspaceName(activeWorkspace.name || '');
        setWorkspaceDescription(activeWorkspace.description || '');
        setArchiveConfirmName('');
        loadMembers();
      }
    }
  }, [isOpen, initialTab, activeWorkspace?.id]);

  useEffect(() => {
    if (isOpen && activeWorkspace) {
      if (activeTab === 'members') loadMembers();
      if (activeTab === 'audit') loadAudit();
    }
  }, [isOpen, activeTab, activeWorkspace?.id]);

  const loadMembers = async () => {
    if (!activeWorkspace) return;
    setIsLoadingMembers(true);
    setMembersError(null);
    try {
      const res = await CollaborationApiClient.listWorkspaceMembers(activeWorkspace.id);
      if (res && res.success && Array.isArray(res.members)) {
        setMembers(res.members);
      } else {
        const errMsg = (res as any)?.error || 'Failed to retrieve workspace members.';
        setMembersError(errMsg);
      }
    } catch (err: any) {
      console.error('Failed to load workspace members', err);
      setMembersError(err.message || 'An unexpected error occurred while loading members.');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const loadAudit = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await CollaborationApiClient.listAuditLogs({
        action: auditFilterAction || undefined,
        result: auditFilterResult || undefined,
        limit: 100
      });
      if (res && res.success && Array.isArray(res.logs)) {
        setAuditLogs(res.logs);
      }
    } catch (err: any) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  if (!isOpen) return null;

  // Handle Rename Workspace
  const handleRenameWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !workspaceName.trim()) return;

    setIsUpdatingWorkspace(true);
    setStatusMsg(null);

    try {
      const res = await CollaborationApiClient.updateWorkspace(
        activeWorkspace.id,
        workspaceName.trim(),
        workspaceDescription.trim() || undefined
      );

      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Workspace updated successfully!' });
        await refreshWorkspaces();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to update workspace.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsUpdatingWorkspace(false);
    }
  };

  // Handle Archive Workspace
  const handleArchiveWorkspace = async () => {
    if (!activeWorkspace) return;
    if (archiveConfirmName.trim().toLowerCase() !== activeWorkspace.name.trim().toLowerCase()) {
      setStatusMsg({ type: 'error', text: 'Workspace name does not match confirmation.' });
      return;
    }

    setIsArchivingWorkspace(true);
    setStatusMsg(null);

    try {
      const res = await CollaborationApiClient.archiveWorkspace(activeWorkspace.id);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Workspace archived successfully.' });
        await refreshWorkspaces();
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to archive workspace.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to archive workspace.' });
    } finally {
      setIsArchivingWorkspace(false);
    }
  };

  // Handle Invite Member
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspace) return;

    setIsInviting(true);
    setStatusMsg(null);

    try {
      const res = await CollaborationApiClient.inviteWorkspaceMember(
        activeWorkspace.id,
        inviteEmail.trim(),
        inviteRole
      );

      if (res.success) {
        setStatusMsg({ type: 'success', text: `Invited ${inviteEmail.trim()} as ${inviteRole}.` });
        setInviteEmail('');
        await loadMembers();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to invite user.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to invite user.' });
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Member Role Change
  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    if (!activeWorkspace) return;
    setStatusMsg(null);
    try {
      const res = await CollaborationApiClient.updateMemberRole(activeWorkspace.id, memberId, newRole);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Member role updated successfully.' });
        await loadMembers();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to update member role.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update member role.' });
    }
  };

  // Handle Confirm Remove Member
  const handleConfirmRemoveMember = async () => {
    if (!activeWorkspace || !memberToRemove) return;

    setIsRemovingMember(true);
    setStatusMsg(null);
    try {
      const res = await CollaborationApiClient.removeMember(activeWorkspace.id, memberToRemove.id);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Removed ${memberToRemove.name || memberToRemove.email} from workspace.` });
        setMemberToRemove(null);
        await loadMembers();
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to remove member.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to remove member.' });
    } finally {
      setIsRemovingMember(false);
    }
  };

  // Filtered Permissions List for the Matrix
  const categories = ['All', 'Workspace', 'Members & Access', 'Data & Queries', 'Pipelines', 'Visuals & Dashboards', 'Reports', 'Compliance'];
  const filteredPermissions = PERMISSION_DEFINITIONS.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      !permissionSearch.trim() ||
      p.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(permissionSearch.toLowerCase()) ||
      p.key.toLowerCase().includes(permissionSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const allRoles: UserRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'ANALYST', 'VIEWER'];
  const canInvite = role === 'OWNER' || role === 'ADMIN' || (can ? can('member.invite') : false);
  const canUpdateRole = role === 'OWNER' || role === 'ADMIN' || (can ? can('member.update') : false);
  const canRemoveMember = role === 'OWNER' || role === 'ADMIN' || (can ? can('member.remove') : false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !memberToRemove) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-settings-title"
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-5xl h-[680px] max-h-[92vh] overflow-hidden text-slate-100 flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/70 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="workspace-settings-title" className="text-sm font-semibold text-white">
                  Workspace Settings
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {activeWorkspace?.name || 'Workspace'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage workspace profile, team members, and RBAC role permissions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Toast / Feedback */}
        {statusMsg && (
          <div
            className={`px-6 py-2 flex items-center justify-between text-xs font-medium border-b ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tabs & Main Body Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar Navigation */}
          <div className="w-56 border-r border-slate-800 bg-slate-950/40 p-3 flex flex-col space-y-1 flex-shrink-0">
            <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Management
            </div>

            <button
              id="ws-settings-tab-general"
              type="button"
              onClick={() => {
                setActiveTab('general');
                setStatusMsg(null);
              }}
              className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors text-left ${
                activeTab === 'general'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span>General</span>
            </button>

            <button
              id="ws-settings-tab-rename"
              type="button"
              onClick={() => {
                setActiveTab('rename');
                setStatusMsg(null);
              }}
              className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors text-left ${
                activeTab === 'rename'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FolderEdit className="w-4 h-4 flex-shrink-0" />
              <span>Rename Workspace</span>
            </button>

            <button
              id="ws-settings-tab-archive"
              type="button"
              onClick={() => {
                setActiveTab('archive');
                setStatusMsg(null);
              }}
              className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors text-left ${
                activeTab === 'archive'
                  ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Archive className="w-4 h-4 flex-shrink-0" />
              <span>Archive Workspace</span>
            </button>

            <div className="pt-3 px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Access & Governance
            </div>

            <button
              id="ws-settings-tab-members"
              type="button"
              onClick={() => {
                setActiveTab('members');
                setStatusMsg(null);
              }}
              className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors text-left ${
                activeTab === 'members'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 flex items-center justify-between">
                <span>Members & Roles</span>
                <span className="px-1.5 py-0.2 bg-slate-800 rounded text-[10px] text-slate-400">
                  {members.length}
                </span>
              </div>
            </button>

            <button
              id="ws-settings-tab-permissions"
              type="button"
              onClick={() => {
                setActiveTab('permissions');
                setStatusMsg(null);
              }}
              className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors text-left ${
                activeTab === 'permissions'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>Role Permissions</span>
            </button>

            <button
              id="ws-settings-tab-audit"
              type="button"
              onClick={() => {
                setActiveTab('audit');
                setStatusMsg(null);
              }}
              className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors text-left ${
                activeTab === 'audit'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span>Audit Logs</span>
            </button>

            {/* Current user role badge at bottom */}
            <div className="mt-auto p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span className="text-[10px] text-slate-400 block mb-1">Your Active Role</span>
              <div className="flex items-center space-x-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getRoleMeta(role).badgeColor}`}>
                  {role}
                </span>
              </div>
            </div>
          </div>

          {/* Right Content Area with Error Boundary Protection */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-900/60">
            <ErrorBoundary fallbackTitle="Workspace Section Error">
              {/* 1. GENERAL TAB */}
              {activeTab === 'general' && (
                <div className="space-y-6 max-w-2xl animate-in fade-in">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">General Workspace Information</h3>
                    <p className="text-xs text-slate-400">Overview of current workspace configuration and team size</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                      <span className="text-[11px] font-medium text-slate-400">Workspace Name</span>
                      <p className="text-sm font-semibold text-white">{activeWorkspace?.name || 'Primary Workspace'}</p>
                    </div>
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                      <span className="text-[11px] font-medium text-slate-400">Workspace ID</span>
                      <p className="text-xs font-mono text-slate-300 select-all">{activeWorkspace?.id || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                      <span className="text-[11px] font-medium text-slate-400">Total Team Members</span>
                      <p className="text-sm font-semibold text-indigo-400">{members.length} active</p>
                    </div>
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                      <span className="text-[11px] font-medium text-slate-400">Isolated Projects</span>
                      <p className="text-sm font-semibold text-emerald-400">{projects.length} projects</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <span className="text-[11px] font-medium text-slate-400">Description</span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {activeWorkspace?.description || 'No description provided for this workspace.'}
                    </p>
                  </div>

                  <div className="p-4 bg-indigo-950/20 border border-indigo-900/40 rounded-xl flex items-start space-x-3">
                    <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-indigo-300 font-semibold block mb-0.5">Quick Tip</strong>
                      To rename this workspace or change settings, navigate to the <button onClick={() => setActiveTab('rename')} className="text-indigo-400 underline font-medium hover:text-indigo-300">Rename Workspace</button> tab. To manage teammates and configure roles, visit <button onClick={() => setActiveTab('members')} className="text-indigo-400 underline font-medium hover:text-indigo-300">Members & Roles</button>.
                    </div>
                  </div>
                </div>
              )}

              {/* 2. RENAME WORKSPACE TAB */}
              {activeTab === 'rename' && (
                <div className="space-y-6 max-w-xl animate-in fade-in">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Rename Workspace</h3>
                    <p className="text-xs text-slate-400">Update the display name and description for all workspace members</p>
                  </div>

                  <form onSubmit={handleRenameWorkspace} className="space-y-4">
                    <div>
                      <label htmlFor="ws-rename-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                        Workspace Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        id="ws-rename-input"
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="e.g. Acme Engineering Team"
                        disabled={isUpdatingWorkspace}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label htmlFor="ws-desc-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                        Description <span className="text-slate-500 font-normal">(optional)</span>
                      </label>
                      <textarea
                        id="ws-desc-input"
                        value={workspaceDescription}
                        onChange={(e) => setWorkspaceDescription(e.target.value)}
                        placeholder="e.g. Primary analytics workspace for production databases and metrics reporting."
                        rows={4}
                        disabled={isUpdatingWorkspace}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-50"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        id="ws-save-rename-btn"
                        type="submit"
                        disabled={isUpdatingWorkspace || !workspaceName.trim()}
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors flex items-center space-x-1.5 disabled:opacity-50 shadow-xs"
                      >
                        {isUpdatingWorkspace ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Updating Workspace...</span>
                          </>
                        ) : (
                          <span>Save Workspace Changes</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 3. ARCHIVE WORKSPACE TAB */}
              {activeTab === 'archive' && (
                <div className="space-y-6 max-w-xl animate-in fade-in">
                  <div>
                    <h3 className="text-sm font-semibold text-rose-400 mb-1">Archive Workspace</h3>
                    <p className="text-xs text-slate-400">Archive this entire workspace and its associated resources</p>
                  </div>

                  <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-3">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <span className="font-semibold text-rose-300">Warning: Destructive Workspace Action</span>
                        <p className="text-slate-400 leading-relaxed">
                          Archiving this workspace will hide it from normal view for all members. Associated queries, pipelines, and dashboards will be preserved in archived state.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-rose-900/30">
                      <label htmlFor="ws-archive-confirm-input" className="block text-[11px] font-medium text-slate-300 mb-1">
                        Please type <strong className="text-white font-mono bg-slate-900 px-1 py-0.5 rounded">{activeWorkspace?.name}</strong> to confirm:
                      </label>
                      <input
                        id="ws-archive-confirm-input"
                        type="text"
                        value={archiveConfirmName}
                        onChange={(e) => setArchiveConfirmName(e.target.value)}
                        placeholder={activeWorkspace?.name}
                        className="w-full px-3 py-2 bg-slate-950 border border-rose-900/60 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-rose-500"
                      />
                    </div>

                    <button
                      id="ws-confirm-archive-btn"
                      type="button"
                      onClick={handleArchiveWorkspace}
                      disabled={isArchivingWorkspace || archiveConfirmName.trim().toLowerCase() !== activeWorkspace?.name.trim().toLowerCase()}
                      className="w-full px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors flex items-center justify-center space-x-2 disabled:opacity-40 shadow-xs"
                    >
                      {isArchivingWorkspace ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Archiving Workspace...</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-4 h-4" />
                          <span>Permanently Archive Workspace</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 4. MEMBERS & ROLES TAB */}
              {activeTab === 'members' && (
                <div className="space-y-6 animate-in fade-in" id="workspace-members-tab-content">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-0.5">Workspace Members & RBAC Roles</h3>
                      <p className="text-xs text-slate-400">Manage user access and assigned privileges</p>
                    </div>

                    {/* Invite Member Inline Form */}
                    {canInvite ? (
                      <form onSubmit={handleInvite} className="flex items-center space-x-2">
                        <input
                          id="ws-invite-email-input"
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="teammate@company.com"
                          disabled={isInviting}
                          className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-52"
                        />
                        <select
                          id="ws-invite-role-select"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as UserRole)}
                          disabled={isInviting}
                          aria-label="Select role to invite"
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-indigo-500"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="EDITOR">EDITOR</option>
                          <option value="ANALYST">ANALYST</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                        <button
                          id="ws-invite-submit-btn"
                          type="submit"
                          disabled={isInviting || !inviteEmail.trim()}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
                        >
                          {isInviting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <UserPlus className="w-3.5 h-3.5" />
                          )}
                          <span>{isInviting ? 'Inviting...' : 'Invite'}</span>
                        </button>
                      </form>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">
                        Role [{role}] does not have invitation privileges.
                      </span>
                    )}
                  </div>

                  {/* Members Error State */}
                  {membersError && (
                    <div className="p-4 bg-rose-950/30 border border-rose-900/50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-rose-300">Unable to load workspace members</p>
                          <p className="text-[11px] text-slate-400">{membersError}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={loadMembers}
                        className="px-3 py-1 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 flex items-center space-x-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3 text-indigo-400" />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}

                  {/* Members List Table / Loading / Empty */}
                  {isLoadingMembers ? (
                    <div className="p-12 border border-slate-800 rounded-xl bg-slate-950/40 flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                      <p className="text-xs text-slate-400 font-medium">Loading workspace team members...</p>
                    </div>
                  ) : members.length === 0 ? (
                    <div className="p-12 border border-slate-800 rounded-xl bg-slate-950/40 flex flex-col items-center justify-center space-y-3 text-center">
                      <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                        <UserX className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">No Members Found</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Use the invite form above to add team members to this workspace.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 shadow-xs">
                      <table className="w-full text-left text-xs" data-testid="workspace-members-table">
                        <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-medium">
                          <tr>
                            <th className="px-4 py-3">Member</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">RBAC Role</th>
                            <th className="px-4 py-3">Joined Date</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {members.map((m) => {
                            const isOwner = m.role === 'OWNER';
                            const memberName = getMemberName(m);
                            const memberEmail = getMemberEmail(m);
                            const memberInitial = getMemberInitial(m);
                            const meta = getRoleMeta(m.role);

                            return (
                              <tr key={m.id} className="hover:bg-slate-800/30 transition-colors" data-testid={`member-row-${m.id}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                      {memberInitial}
                                    </div>
                                    <div>
                                      <div className="font-medium text-white">{memberName}</div>
                                      <div className="text-[11px] text-slate-400">{memberEmail || 'No email attached'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                    {m.status || 'active'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {isOwner ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-700/50">
                                      OWNER
                                    </span>
                                  ) : canUpdateRole ? (
                                    <select
                                      value={m.role}
                                      onChange={(e) => handleRoleChange(m.id, e.target.value as UserRole)}
                                      aria-label={`Change role for ${memberEmail || memberName}`}
                                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-hidden focus:border-indigo-500 font-medium"
                                    >
                                      <option value="ADMIN">ADMIN</option>
                                      <option value="EDITOR">EDITOR</option>
                                      <option value="ANALYST">ANALYST</option>
                                      <option value="VIEWER">VIEWER</option>
                                    </select>
                                  ) : (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${meta.badgeColor}`}>
                                      {m.role}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-400 text-[11px]">
                                  {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : (m.invitedAt ? new Date(m.invitedAt).toLocaleDateString() : 'N/A')}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {!isOwner && canRemoveMember && (
                                    <button
                                      type="button"
                                      onClick={() => setMemberToRemove({ id: m.id, name: memberName, email: memberEmail })}
                                      title={`Remove ${memberName}`}
                                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Role Reference Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {allRoles.map((r) => {
                      const meta = getRoleMeta(r);
                      return (
                        <div key={r} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${meta.badgeColor}`}>
                              {r}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-normal">{meta.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. ROLE PERMISSIONS MATRIX TAB */}
              {activeTab === 'permissions' && (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">RBAC Role Permissions Matrix</h3>
                    <p className="text-xs text-slate-400">
                      Comprehensive breakdown of capabilities enforced by backend authorization rules
                    </p>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Category Pills */}
                    <div className="flex flex-wrap items-center gap-1">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            selectedCategory === cat
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={permissionSearch}
                        onChange={(e) => setPermissionSearch(e.target.value)}
                        placeholder="Filter permissions..."
                        className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-48"
                      />
                    </div>
                  </div>

                  {/* Permissions Matrix Table */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 border-b border-slate-800 text-slate-300 font-medium">
                        <tr>
                          <th className="px-4 py-2.5 min-w-[220px]">Permission Capability</th>
                          <th className="px-3 py-2.5 text-center w-20">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-700/50">
                              OWNER
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-center w-20">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                              ADMIN
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-center w-20">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                              EDITOR
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-center w-20">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                              ANALYST
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-center w-20">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              VIEWER
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredPermissions.map((perm) => (
                          <tr key={perm.key} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-white text-xs">{perm.name}</div>
                              <div className="text-[11px] text-slate-400">{perm.description}</div>
                              <code className="text-[10px] text-slate-500 font-mono">{perm.key}</code>
                            </td>
                            {allRoles.map((r) => {
                              const hasPerm = ROLE_PERMISSIONS_MAP[r]?.includes(perm.key);
                              return (
                                <td key={r} className="px-3 py-2.5 text-center">
                                  {hasPerm ? (
                                    <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400">
                                      <Check className="w-3.5 h-3.5" />
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center justify-center w-5 h-5 rounded-full text-slate-600">
                                      <Minus className="w-3.5 h-3.5" />
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. AUDIT LOGS TAB */}
              {activeTab === 'audit' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-0.5">Immutable Audit & Compliance Logs</h3>
                      <p className="text-xs text-slate-400">Real-time security trail for access tracking and governance</p>
                    </div>
                    <button
                      type="button"
                      onClick={loadAudit}
                      disabled={isLoadingAudit}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 flex items-center space-x-1.5 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* Audit Table */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-medium">
                        <tr>
                          <th className="px-4 py-2.5">Timestamp</th>
                          <th className="px-4 py-2.5">Action</th>
                          <th className="px-4 py-2.5">User</th>
                          <th className="px-4 py-2.5">Result</th>
                          <th className="px-4 py-2.5">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                              No audit events recorded yet.
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-4 py-2 text-slate-400 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString()} &bull; {new Date(log.timestamp).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2 text-indigo-300 font-semibold">{log.action}</td>
                              <td className="px-4 py-2 text-slate-300">{log.actorName || log.actorId}</td>
                              <td className="px-4 py-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    log.result === 'SUCCESS'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}
                                >
                                  {log.result}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-slate-400 truncate max-w-xs" title={JSON.stringify(log.metadata || {})}>
                                {log.resourceType || log.resourceId || JSON.stringify(log.metadata || {})}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </ErrorBoundary>
          </div>
        </div>
      </div>

      {/* Member Removal Confirmation Dialog */}
      {memberToRemove && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 text-slate-100">
            <h3 className="text-sm font-semibold text-rose-400 flex items-center space-x-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Remove Workspace Member</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{memberToRemove.name}</strong> ({memberToRemove.email}) from this workspace? They will lose access to all queries, dashboards, and pipelines within this workspace.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={() => setMemberToRemove(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={handleConfirmRemoveMember}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                {isRemovingMember ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Confirm Removal</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
