import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { PermissionService } from '../services/PermissionService';
import { UserRole } from '../../src/types/collaboration';
import { Logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user and create an initial session
 */
router.post('/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Valid full name is required.' });
      return;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'Valid email address is required.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const existing = store.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, error: 'A user with this email address already exists.' });
      return;
    }

    const user = store.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: (role as UserRole) || 'ANALYST'
    });

    // Automatically assign user to primary workspace as an active member
    const primaryWs = store.getWorkspaceById('ws_primary');
    if (primaryWs) {
      store.addOrInviteMember('ws_primary', user.id, (role as UserRole) || 'ANALYST');
    }

    const session = store.createSession(user.id, req.ip, req.headers['user-agent']);

    res.cookie('datapilot_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const userRole: UserRole = user.role || 'ANALYST';
    const permissions = PermissionService.getPermissionsForRole(userRole);

    store.logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      workspaceId: 'ws_primary',
      action: 'USER_REGISTERED',
      result: 'SUCCESS',
      metadata: { email: user.email, role: userRole },
      correlationId: req.correlationId
    });

    res.status(201).json({
      success: true,
      user,
      session,
      workspaceId: 'ws_primary',
      memberRole: userRole,
      permissions
    });
  } catch (err: any) {
    Logger.error('Registration failed', err);
    res.status(500).json({ success: false, error: 'Failed to complete registration.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with credentials
 */
router.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const userAuth = store.getUserByEmail(email);

    if (!userAuth) {
      store.logAuditEvent({
        actorId: 'anonymous',
        actorName: 'unknown',
        workspaceId: 'global',
        action: 'LOGIN_FAILED',
        result: 'FAILURE',
        metadata: { email },
        correlationId: req.correlationId
      });

      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    if (userAuth.status === 'suspended') {
      res.status(403).json({ success: false, error: 'Your account is suspended. Please contact your workspace administrator.' });
      return;
    }

    const isMatch = CollaborationStore.verifyPassword(password, userAuth.passwordHash, userAuth.salt);
    if (!isMatch) {
      store.logAuditEvent({
        actorId: userAuth.id,
        actorName: userAuth.name,
        workspaceId: 'global',
        action: 'LOGIN_FAILED',
        result: 'FAILURE',
        metadata: { email: userAuth.email },
        correlationId: req.correlationId
      });

      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const session = store.createSession(userAuth.id, req.ip, req.headers['user-agent']);

    res.cookie('datapilot_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const user = store.getUserById(userAuth.id)!;
    const workspaces = store.listWorkspacesForUser(user.id);
    const activeWsId = workspaces.length > 0 ? workspaces[0].id : 'ws_primary';
    const member = store.getWorkspaceMember(activeWsId, user.id);
    const role: UserRole = member?.role || user.role || 'ANALYST';
    const permissions = PermissionService.getPermissionsForRole(role);

    store.logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      workspaceId: activeWsId,
      action: 'LOGIN_SUCCESS',
      result: 'SUCCESS',
      metadata: { email: user.email, role },
      correlationId: req.correlationId
    });

    res.json({
      success: true,
      user,
      session,
      workspaceId: activeWsId,
      memberRole: role,
      permissions
    });
  } catch (err: any) {
    Logger.error('Login error', err);
    res.status(500).json({ success: false, error: 'An unexpected authentication error occurred.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const token = req.cookies?.datapilot_session || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);

    if (token) {
      store.deleteSession(token);
    }
    res.clearCookie('datapilot_session');

    if (req.authContext?.user) {
      store.logAuditEvent({
        actorId: req.authContext.user.id,
        actorName: req.authContext.user.name,
        workspaceId: req.authContext.workspaceId || 'global',
        action: 'LOGOUT',
        result: 'SUCCESS',
        metadata: {},
        correlationId: req.correlationId
      });
    }

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to logout cleanly.' });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user and session
 */
router.get('/me', (req: Request, res: Response) => {
  if (!req.authContext || !req.authContext.user) {
    res.status(401).json({ success: false, error: 'Not authenticated.' });
    return;
  }

  res.json({
    success: true,
    user: req.authContext.user,
    session: req.authContext.session,
    workspaceId: req.authContext.workspaceId,
    memberRole: req.authContext.memberRole,
    permissions: req.authContext.permissions
  });
});

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', (req: Request, res: Response) => {
  try {
    if (!req.authContext || !req.authContext.user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const userAuth = store.getUserByEmail(req.authContext.user.email);
    if (!userAuth) {
      res.status(404).json({ success: false, error: 'User record not found.' });
      return;
    }

    if (oldPassword) {
      const isMatch = CollaborationStore.verifyPassword(oldPassword, userAuth.passwordHash, userAuth.salt);
      if (!isMatch) {
        res.status(400).json({ success: false, error: 'Current password is incorrect.' });
        return;
      }
    }

    store.changeUserPassword(req.authContext.user.id, newPassword);

    store.logAuditEvent({
      actorId: req.authContext.user.id,
      actorName: req.authContext.user.name,
      workspaceId: req.authContext.workspaceId,
      action: 'PASSWORD_CHANGED',
      result: 'SUCCESS',
      metadata: {},
      correlationId: req.correlationId
    });

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to change password.' });
  }
});

/**
 * GET /api/auth/sessions
 */
router.get('/sessions', (req: Request, res: Response) => {
  if (!req.authContext?.user) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  const sessions = CollaborationStore.getInstance().getUserActiveSessions(req.authContext.user.id);
  res.json({ success: true, sessions });
});

export const authRoutes = router;
