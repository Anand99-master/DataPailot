import React from 'react';
import { WorkspaceSettingsModal, WorkspaceSettingsTab } from './WorkspaceSettingsModal';

interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: WorkspaceSettingsTab;
}

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'members'
}) => {
  return (
    <WorkspaceSettingsModal
      isOpen={isOpen}
      onClose={onClose}
      initialTab={initialTab}
    />
  );
};
