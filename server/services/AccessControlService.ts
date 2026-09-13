import { CollaborationStore } from '../database/CollaborationStore';
import { PermissionService } from './PermissionService';
import { ResourceType, ResourceVisibility, UserRole, ShareAccessLevel } from '../../src/types/collaboration';
import { Logger } from '../utils/logger';

export class AccessControlService {
  private static instance: AccessControlService;

  private constructor() {}

  public static getInstance(): AccessControlService {
    if (!AccessControlService.instance) {
      AccessControlService.instance = new AccessControlService();
    }
    return AccessControlService.instance;
  }

  /**
   * Authorizes a user's access to a specific workspace resource.
   * Prevents IDOR and cross-workspace access attempts.
   */
  public authorizeResource(params: {
    userId: string;
    workspaceId: string;
    resourceType: ResourceType;
    resourceId: string;
    resourceOwnerId?: string;
    resourceWorkspaceId: string;
    resourceVisibility?: ResourceVisibility;
    action: 'read' | 'write' | 'delete' | 'share';
  }): { authorized: boolean; reason?: string } {
    const {
      userId,
      workspaceId,
      resourceType,
      resourceId,
      resourceOwnerId,
      resourceWorkspaceId,
      resourceVisibility,
      action
    } = params;

    const store = CollaborationStore.getInstance();

    // 1. Cross-Workspace Isolation & Anti-IDOR Check:
    // If the resource belongs to another workspace than the user's active workspace context, block access!
    if (resourceWorkspaceId && resourceWorkspaceId !== workspaceId) {
      Logger.warn('Cross-workspace resource access denied (Anti-IDOR)', {
        userId,
        activeWorkspace: workspaceId,
        resourceWorkspace: resourceWorkspaceId,
        resourceType,
        resourceId
      });
      return {
        authorized: false,
        reason: 'Resource does not belong to the active workspace context.'
      };
    }

    // 2. Resolve user's membership and role in this workspace
    const member = store.getWorkspaceMember(workspaceId, userId);
    if (!member || member.status !== 'active') {
      return {
        authorized: false,
        reason: 'You are not an active member of this workspace.'
      };
    }

    const role: UserRole = member.role;

    // 3. Resolve direct share grant (if any)
    const directShare: ShareAccessLevel | null = store.getUserDirectShare(
      resourceType,
      resourceId,
      userId
    );

    // 4. Delegate to PermissionService
    const check = PermissionService.canAccessResource({
      userId,
      workspaceRole: role,
      resourceOwnerId,
      resourceVisibility,
      directShare,
      action
    });

    return {
      authorized: check.allowed,
      reason: check.reason
    };
  }
}
