import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { CollaborationApiClient } from '../../services/collaborationApi';
import { WorkspaceMember, UserRole, AuditLogEntry } from '../../types/collaboration';
import {
  X,
  Users,
  Shield,
  FileText,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Building2
} from 'lucide-react';

interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({ isOpen, onClose }) => {
  const { activeWorkspace, role, refreshWorkspaces } = useCollaboration();
  const [tab, setTab] = useState<'members' | 'audit' | 'settings'>('members');

  // Members state
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('ANALYST');
  const [isInviting, setIsInviting] = useState(false);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterResult, setAuditFilterResult] = useState('');
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && activeWorkspace) {
      loadMembers();
      if (tab === 'audit') loadAudit();
    }
  }, [isOpen, activeWorkspace, tab]);

  const loadMembers = async () => {
    if (!activeWorkspace) return;
    const res = await CollaborationApiClient.listWorkspaceMembers(activeWorkspace.id);
    if (res.success) setMembers(res.members);
  };

  const loadAudit = async () => {
    setIsLoadingAudit(true);
    const res = await CollaborationApiClient.listAuditLogs({
      action: auditFilterAction || undefined,
      result: auditFilterResult || undefined,
      limit: 100
    });
    if (res.success) setAuditLogs(res.logs);
    setIsLoadingAudit(false);
  };

  if (!isOpen) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !activeWorkspace) return;
    setIsInviting(true);
    setStatusMsg(null);

    const res = await CollaborationApiClient.inviteWorkspaceMember(
      activeWorkspace.id,
      inviteEmail.trim(),
      inviteRole
    );
    setIsInviting(false);

    if (res.success) {
      setStatusMsg({ type: 'success', text: `Invited ${inviteEmail} as ${inviteRole}.` });
      setInviteEmail('');
      await loadMembers();
    } else {
      setStatusMsg({ type: 'error', text: res.error || 'Failed to invite user.' });
    }
  };

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    if (!activeWorkspace) return;
    setStatusMsg(null);
    const res = await CollaborationApiClient.updateMemberRole(activeWorkspace.id, memberId, newRole);
    if (res.success) {
      setStatusMsg({ type: 'success', text: 'Member role updated.' });
      await loadMembers();
    } else {
      setStatusMsg({ type: 'error', text: res.error || 'Failed to update member role.' });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeWorkspace) return;
    if (!confirm('Are you sure you want to remove this member from the workspace?')) return;
    setStatusMsg(null);
    const res = await CollaborationApiClient.removeMember(activeWorkspace.id, memberId);
    if (res.success) {
      setStatusMsg({ type: 'success', text: 'Member removed from workspace.' });
      await loadMembers();
    } else {
      setStatusMsg({ type: 'error', text: res.error || 'Failed to remove member.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl h-[620px] overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Workspace Admin Console</h3>
              <p className="text-xs text-slate-400">
                {activeWorkspace?.name || 'Workspace'} &bull; Members, RBAC & Immutable Audit Logs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-950/40 text-xs space-x-6 flex-shrink-0">
          <button
            onClick={() => setTab('members')}
            className={`py-3 font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              tab === 'members'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members & Roles ({members.length})</span>
          </button>

          <button
            onClick={() => setTab('audit')}
            className={`py-3 font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              tab === 'audit'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Audit & Compliance Logs</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {statusMsg && (
            <div
              className={`flex items-center space-x-2 p-3 rounded-lg text-xs border ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Members Tab */}
          {tab === 'members' && (
            <div className="space-y-6">
              {/* Invite Member Box */}
              <form onSubmit={handleInvite} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold text-white">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>Invite New Workspace Member</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="sm:col-span-6 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden"
                  />
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as UserRole)}
                    className="sm:col-span-3 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden"
                  >
                    <option value="ANALYST">Analyst</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="EDITOR">Editor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="sm:col-span-3 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isInviting ? 'Inviting...' : 'Invite Member'}
                  </button>
                </div>
              </form>

              {/* Members Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Assigned Role</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {members.map(m => (
                      <tr key={m.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-white flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-300">
                            {(m.userName || m.userEmail || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span>{m.userName || 'Invited User'}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{m.userEmail}</td>
                        <td className="px-4 py-3">
                          <select
                            disabled={m.role === 'OWNER' && role !== 'OWNER'}
                            value={m.role}
                            onChange={e => handleRoleChange(m.id, e.target.value as UserRole)}
                            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-hidden disabled:opacity-50"
                          >
                            <option value="OWNER">OWNER</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="EDITOR">EDITOR</option>
                            <option value="ANALYST">ANALYST</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {new Date(m.joinedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {m.role !== 'OWNER' && (
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                              title="Remove member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit Logs Tab */}
          {tab === 'audit' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="text-slate-400 flex items-center space-x-1">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter:</span>
                  </span>
                  <input
                    type="text"
                    value={auditFilterAction}
                    onChange={e => setAuditFilterAction(e.target.value)}
                    placeholder="Filter by action (e.g. QUERY, LOGIN)..."
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500"
                  />
                  <select
                    value={auditFilterResult}
                    onChange={e => setAuditFilterResult(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                  >
                    <option value="">All Results</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="DENIED">DENIED</option>
                    <option value="FAILURE">FAILURE</option>
                  </select>
                  <button
                    onClick={loadAudit}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Apply</span>
                  </button>
                </div>
              </div>

              {/* Logs table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950 max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">Timestamp</th>
                      <th className="px-3 py-2.5">Actor</th>
                      <th className="px-3 py-2.5">Action</th>
                      <th className="px-3 py-2.5">Resource</th>
                      <th className="px-3 py-2.5">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-900/40">
                        <td className="px-3 py-2 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-medium text-white">{log.actorName}</td>
                        <td className="px-3 py-2 font-mono text-slate-300 text-[11px]">{log.action}</td>
                        <td className="px-3 py-2 text-slate-400 text-[11px]">
                          {log.resourceType ? `${log.resourceType}:${log.resourceId || ''}` : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              log.result === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                : log.result === 'DENIED'
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {log.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
