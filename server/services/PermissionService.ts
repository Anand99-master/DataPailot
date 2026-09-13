import { Permission, UserRole, ResourceVisibility, ShareAccessLevel } from '../../src/types/collaboration';

/**
 * RBAC Role to Permissions mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: [
    'workspace.read',
    'workspace.update',
    'workspace.delete',
    'member.read',
    'member.invite',
    'member.update',
    'member.remove',
    'dataset.read',
    'dataset.create',
    'dataset.update',
    'dataset.delete',
    'query.read',
    'query.create',
    'query.update',
    'query.delete',
    'pipeline.read',
    'pipeline.create',
    'pipeline.update',
    'pipeline.delete',
    'visualization.read',
    'visualization.create',
    'visualization.update',
    'visualization.delete',
    'dashboard.read',
    'dashboard.create',
    'dashboard.update',
    'dashboard.delete',
    'report.read',
    'report.create',
    'report.export',
    'audit.read'
  ],
  ADMIN: [
    'workspace.read',
    'workspace.update',
    'workspace.manage_members',
    'member.read',
    'member.invite',
    'member.update',
    'member.remove',
    'dataset.read',
    'dataset.create',
    'dataset.update',
    'dataset.delete',
    'query.read',
    'query.create',
    'query.update',
    'query.delete',
    'pipeline.read',
    'pipeline.create',
    'pipeline.update',
    'pipeline.delete',
    'visualization.read',
    'visualization.create',
    'visualization.update',
    'visualization.delete',
    'dashboard.read',
    'dashboard.create',
    'dashboard.update',
    'dashboard.delete',
    'report.read',
    'report.create',
    'report.export',
    'audit.read'
  ],
  EDITOR: [
    'workspace.read',
    'member.read',
    'dataset.read',
    'dataset.create',
    'dataset.update',
    'query.read',
    'query.create',
    'query.update',
    'query.delete',
    'pipeline.read',
    'pipeline.create',
    'pipeline.update',
    'pipeline.delete',
    'visualization.read',
    'visualization.create',
    'visualization.update',
    'visualization.delete',
    'dashboard.read',
    'dashboard.create',
    'dashboard.update',
    'dashboard.delete',
    'report.read',
    'report.create',
    'report.export'
  ],
  ANALYST: [
    'workspace.read',
    'member.read',
    'dataset.read',
    'dataset.create',
    'dataset.update',
    'query.read',
    'query.create',
    'query.update',
    'query.delete',
    'pipeline.read',
    'pipeline.create',
    'pipeline.update',
    'pipeline.delete',
    'visualization.read',
    'visualization.create',
    'visualization.update',
    'visualization.delete',
    'dashboard.read',
    'dashboard.create',
    'dashboard.update',
    'dashboard.delete',
    'report.read',
    'report.create',
    'report.export'
  ],
  VIEWER: [
    'workspace.read',
    'member.read',
    'dataset.read',
    'query.read',
    'pipeline.read',
    'visualization.read',
    'dashboard.read',
    'report.read',
    'report.export'
  ]
};

export class PermissionService {
  /**
   * Get all permissions granted to a role
   */
  public static getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.VIEWER;
  }

  /**
   * Check if a role possesses a specific permission
   */
  public static hasPermission(role: UserRole, permission: Permission): boolean {
    const perms = this.getPermissionsForRole(role);
    return perms.includes(permission);
  }

  /**
   * Evaluate if a user can perform an operation on a resource given ownership,
   * workspace role, resource visibility, and direct share grants.
   */
  public static canAccessResource(params: {
    userId: string;
    workspaceRole: UserRole;
    resourceOwnerId?: string;
    resourceVisibility?: ResourceVisibility;
    directShare?: ShareAccessLevel | null;
    action: 'read' | 'write' | 'delete' | 'share';
  }): { allowed: boolean; reason?: string } {
    const { userId, workspaceRole, resourceOwnerId, resourceVisibility, directShare, action } = params;

    // 1. Workspace OWNER or ADMIN have full control over all workspace resources
    if (workspaceRole === 'OWNER' || workspaceRole === 'ADMIN') {
      return { allowed: true };
    }

    // 2. Resource Owner has full access to their own resources
    if (resourceOwnerId && resourceOwnerId === userId) {
      return { allowed: true };
    }

    // 3. Delete action requires ownership, Admin, or Owner role
    if (action === 'delete') {
      return { allowed: false, reason: 'Only the resource owner or workspace administrators can delete this item.' };
    }

    // 4. Share action requires owner, admin, or editor share
    if (action === 'share') {
      if (directShare === 'editor') return { allowed: true };
      return { allowed: false, reason: 'You need editor or administrator permissions to share this resource.' };
    }

    // 5. Direct share explicitly grants access
    if (directShare === 'editor') {
      return { allowed: true };
    }
    if (directShare === 'viewer') {
      if (action === 'read') return { allowed: true };
      return { allowed: false, reason: 'Viewer share only permits read-only access.' };
    }

    // 6. Resource Visibility check
    const visibility = resourceVisibility || 'WORKSPACE';

    if (visibility === 'PRIVATE') {
      return { allowed: false, reason: 'This resource is marked private to its author.' };
    }

    if (visibility === 'WORKSPACE' || visibility === 'SHARED') {
      if (action === 'read') {
        return { allowed: true };
      }
      if (action === 'write') {
        // Analysts can modify workspace-level collaborative resources
        if (workspaceRole === 'ANALYST') {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Viewer role cannot modify workspace resources.' };
      }
    }

    return { allowed: false, reason: 'Access denied.' };
  }
}
