import React, { useState } from 'react';
import { Project } from '../../types/collaboration';
import { CollaborationApiClient } from '../../services/collaborationApi';
import { useCollaboration } from '../../context/CollaborationContext';
import { Archive, X, AlertTriangle, Loader2 } from 'lucide-react';

interface ArchiveProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ArchiveProjectModal: React.FC<ArchiveProjectModalProps> = ({
  isOpen,
  project,
  onClose,
  onSuccess
}) => {
  const { refreshProjects, activeProject, switchProject } = useCollaboration();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const handleArchive = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await CollaborationApiClient.archiveProject(project.id);
      if (res.success) {
        // If this was the active project, reset active project to null (All Projects)
        if (activeProject?.id === project.id) {
          switchProject(null);
        }
        await refreshProjects();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to archive project.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-project-title"
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-100"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 id="archive-project-title" className="text-sm font-semibold text-white">
                Archive Project
              </h3>
              <p className="text-xs text-slate-400">Confirm project archive</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="flex items-start space-x-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-lg space-y-2">
            <div className="flex items-center space-x-2 text-rose-300 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Are you sure you want to archive this project?</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Archiving <strong className="text-white font-medium">"{project.name}"</strong> will remove it from the active project selector. Associated queries and dashboards will remain preserved in the archive.
            </p>
          </div>

          <div className="text-xs text-slate-400">
            <p>
              Project ID: <code className="px-1.5 py-0.5 bg-slate-950 rounded text-slate-300">{project.id}</code>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white transition-colors flex items-center space-x-1.5 disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Archiving...</span>
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Project</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
