import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { CollaborationApiClient } from '../../services/collaborationApi';
import { ResourceType, ResourceShare, ShareAccessLevel, WorkspaceMember } from '../../types/collaboration';
import { X, Share2, Users, Shield, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ShareResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: ResourceType;
  resourceId: string;
  resourceTitle: string;
}

export const ShareResourceModal: React.FC<ShareResourceModalProps> = ({
  isOpen,
  onClose,
  resourceType,
  resourceId,
  resourceTitle
}) => {
  const { activeWorkspace } = useCollaboration();
  const [shares, setShares] = useState<ResourceShare[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>('VIEW');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && activeWorkspace) {
      loadData();
    }
  }, [isOpen, activeWorkspace, resourceType, resourceId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sharesRes, membersRes] = await Promise.all([
        CollaborationApiClient.listResourceShares(resourceType, resourceId),
        CollaborationApiClient.listWorkspaceMembers(activeWorkspace!.id)
      ]);
      if (sharesRes.success) setShares(sharesRes.shares);
      if (membersRes.success) setMembers(membersRes.members);
    } catch (err) {
      console.error('Failed to load sharing data', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setStatusMsg(null);
    const res = await CollaborationApiClient.shareResource(
      resourceType,
      resourceId,
      selectedUserId,
      accessLevel
    );

    if (res.success) {
      setStatusMsg({ type: 'success', text: 'Share grant updated successfully.' });
      setSelectedUserId('');
      await loadData();
    } else {
      setStatusMsg({ type: 'error', text: res.error || 'Failed to share resource.' });
    }
  };

  const handleRevoke = async (shareId: string) => {
    const res = await CollaborationApiClient.revokeShare(shareId);
    if (res.success) {
      await loadData();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Share Resource</h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">
                {resourceTitle} &bull; <span className="uppercase">{resourceType}</span>
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

        <div className="p-6 space-y-5">
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

          {/* Add Share Form */}
          <form onSubmit={handleShare} className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Share with Workspace Member</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <select
                required
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="sm:col-span-7 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden"
              >
                <option value="">Select workspace member...</option>
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>
                    {m.userName || m.userEmail} ({m.role})
                  </option>
                ))}
              </select>

              <select
                value={accessLevel}
                onChange={e => setAccessLevel(e.target.value as ShareAccessLevel)}
                className="sm:col-span-3 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden"
              >
                <option value="VIEW">Can View</option>
                <option value="EDIT">Can Edit</option>
                <option value="ADMIN">Admin</option>
              </select>

              <button
                type="submit"
                className="sm:col-span-2 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                Grant
              </button>
            </div>
          </form>

          {/* Current Direct Shares List */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Current Access & Direct Grants ({shares.length})
            </h4>

            <div className="max-h-48 overflow-y-auto space-y-2">
              {shares.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/60">
                  No individual direct shares. Workspace members inherit default workspace-level permissions.
                </div>
              ) : (
                shares.map(s => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white">{s.sharedWithUserName || s.sharedWithUserId}</span>
                      <div className="text-[11px] text-slate-400">
                        Access Level: <span className="text-indigo-400 font-semibold">{s.accessLevel}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevoke(s.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Revoke access"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
