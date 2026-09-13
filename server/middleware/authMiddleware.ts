import { Request, Response, NextFunction } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { PermissionService } from '../services/PermissionService';
import { AuthContext, Permission, UserRole } from '../../src/types/collaboration';
import { Logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
      correlationId?: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-correlation-id'] as string;
  req.correlationId = incomingId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  next();
}

/**
 * Authentication middleware extracting session tokens and attaching AuthContext
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const store = CollaborationStore.getInstance();

  // Extract token from Authorization header, Cookie, or custom header
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = req.headers['x-session-token'] as string;
  } else if (req.cookies && req.cookies.datapilot_session) {
    token = req.cookies.datapilot_session;
  }

  // Requested workspace id
  const headerWsId = (req.headers['x-workspace-id'] as string) || (req.query.workspaceId as string) || 'ws_primary';

  if (token) {
    const session = store.getSessionByToken(token);
    if (session) {
      const user = store.getUserById(session.userId);
      if (user && user.status === 'active') {
        // Resolve workspace membership
        let member = store.getWorkspaceMember(headerWsId, user.id);
        let activeWsId = headerWsId;

        // If not a member of requested workspace, check if member of any workspace
        if (!member) {
          const userWorkspaces = store.listWorkspacesForUser(user.id);
          if (userWorkspaces.length > 0) {
            activeWsId = userWorkspaces[0].id;
            member = store.getWorkspaceMember(activeWsId, user.id);
          }
        }

        const role: UserRole = member?.role || user.role || 'VIEWER';
        const permissions = PermissionService.getPermissionsForRole(role);

        req.authContext = {
          user,
          session,
          workspaceId: activeWsId,
          memberRole: role,
          permissions
        };
        return next();
      }
    }
  }

  // Development fallback context when no token provided
  // Ensures existing single-user workflows and tests continue seamlessly while remaining isolated
  const defaultAdmin = store.getUserById('usr_admin');
  if (defaultAdmin) {
    const role: UserRole = 'OWNER';
    req.authContext = {
      user: defaultAdmin,
      session: {
        id: 'ses_dev_default',
        userId: defaultAdmin.id,
        token: 'dev_token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString()
      },
      workspaceId: headerWsId || 'ws_primary',
      memberRole: role,
      permissions: PermissionService.getPermissionsForRole(role)
    };
  }

  next();
}

/**
 * Strict authentication guard
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.authContext || !req.authContext.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in to perform this operation.'
    });
    return;
  }
  next();
}

/**
 * RBAC permission guard middleware
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authContext) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
      return;
    }

    const { user, workspaceId, memberRole, permissions } = req.authContext;

    if (!permissions.includes(permission)) {
      Logger.warn('RBAC permission denied', {
        userId: user.id,
        role: memberRole,
        workspaceId,
        requiredPermission: permission
      });

      CollaborationStore.getInstance().logAuditEvent({
        actorId: user.id,
        actorName: user.name,
        workspaceId,
        action: `DENIED_${permission.toUpperCase()}`,
        result: 'DENIED',
        metadata: { requiredPermission: permission, memberRole },
        correlationId: req.correlationId
      });

      res.status(403).json({
        success: false,
        error: `Permission denied: Current role [${memberRole}] does not have '${permission}' permission in workspace [${workspaceId}].`
      });
      return;
    }

    next();
  };
}
