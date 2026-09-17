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

    const requestedRole = (role as UserRole) || 'ANALYST';
    if (requestedRole === 'OWNER' || requestedRole === 'ADMIN') {
      res.status(403).json({ success: false, error: 'Cannot register with administrative roles directly. Client role spoofing is rejected.' });
      return;
    }

    const assignedRole: UserRole = (requestedRole === 'EDITOR' || requestedRole === 'VIEWER' || requestedRole === 'ANALYST') ? requestedRole : 'ANALYST';

    const user = store.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: assignedRole
    });

    // Automatically assign user to primary workspace as an active member
    const primaryWs = store.getWorkspaceById('ws_primary');
    if (primaryWs) {
      store.addOrInviteMember('ws_primary', user.id, assignedRole);
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
 * POST /api/auth/demo-switch
 * Instant demo persona switcher for testing RBAC profiles (OWNER/ADMIN, ANALYST, VIEWER)
 * Changes RBAC role/permissions without corrupting or overwriting custom user profile information.
 */
router.post('/demo-switch', (req: Request, res: Response) => {
  try {
    const isDemoEnabled = process.env.DEMO_MODE === 'true' || (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false');
    if (!isDemoEnabled) {
      res.status(403).json({ success: false, error: 'Demo persona switching is disabled in production / non-demo mode.' });
      return;
    }

    const { role: reqRole } = req.body;
    const store = CollaborationStore.getInstance();

    let targetRole: UserRole = 'OWNER';
    const normalized = (reqRole || '').toString().toLowerCase().trim();
    if (normalized === 'analyst') {
      targetRole = 'ANALYST';
    } else if (normalized === 'viewer') {
      targetRole = 'VIEWER';
    } else if (normalized === 'admin' || normalized === 'owner') {
      targetRole = 'OWNER';
    } else if (normalized === 'editor') {
      targetRole = 'EDITOR';
    }

    // Preserve the current authenticated user's profile info (name, jobTitle, email) if available,
    // or fallback to the primary user record
    let currentUserId = req.authContext?.user?.id || 'usr_admin';
    let user = store.getUserById(currentUserId) || store.getUserById('usr_admin');

    if (!user) {
      user = {
        id: currentUserId,
        name: 'Alex Rivera',
        email: 'admin@datapilot.io',
        jobTitle: 'Lead Data Architect',
        status: 'active',
        role: targetRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    const wsId = (req.headers['x-workspace-id'] as string) || (req.body.workspaceId as string) || 'ws_primary';
    const member = store.getWorkspaceMember(wsId, user.id);
    if (!member) {
      try {
        store.addOrInviteMember(wsId, user.id, targetRole);
      } catch {
        // ignore if already present
      }
    } else {
      try {
        store.updateMemberRole(wsId, user.id, targetRole);
      } catch {
        // ignore
      }
    }

    const session = store.createSession(user.id, req.ip, req.headers['user-agent']);

    res.cookie('datapilot_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const permissions = PermissionService.getPermissionsForRole(targetRole);

    store.logAuditEvent({
      actorId: user.id,
      actorName: user.name,
      workspaceId: wsId,
      action: 'DEMO_PERSONA_SWITCHED',
      result: 'SUCCESS',
      metadata: { role: targetRole, userId: user.id, email: user.email },
      correlationId: req.correlationId
    });

    res.json({
      success: true,
      user: { ...user, role: targetRole },
      session,
      workspaceId: wsId,
      memberRole: targetRole,
      permissions
    });
  } catch (err: any) {
    Logger.error('Demo persona switch failed', err);
    res.status(500).json({ success: false, error: 'Failed to switch demo persona.' });
  }
});

/**
 * PUT /api/auth/profile
 * Update current authenticated user profile (Full Name, Job Title, Email, Avatar)
 * RBAC role is strictly protected and cannot be changed here.
 */
router.put('/profile', (req: Request, res: Response) => {
  try {
    if (!req.authContext || !req.authContext.user) {
      res.status(401).json({ success: false, error: 'Authentication required to edit profile.' });
      return;
    }

    const { name, jobTitle, email, avatar } = req.body;
    const store = CollaborationStore.getInstance();
    const currentUser = req.authContext.user;

    // 1. Validation: Name
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, error: 'Full name cannot be empty.' });
        return;
      }
      if (name.trim().length > 100) {
        res.status(400).json({ success: false, error: 'Full name cannot exceed 100 characters.' });
        return;
      }
    }

    // 2. Validation: Job Title
    if (jobTitle !== undefined && jobTitle !== null) {
      if (typeof jobTitle !== 'string') {
        res.status(400).json({ success: false, error: 'Job title must be a valid text string.' });
        return;
      }
      if (jobTitle.trim().length > 100) {
        res.status(400).json({ success: false, error: 'Job title cannot exceed 100 characters.' });
        return;
      }
    }

    // 3. Validation: Email
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) {
        res.status(400).json({ success: false, error: 'Email address cannot be empty.' });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
        return;
      }
      if (email.trim().length > 150) {
        res.status(400).json({ success: false, error: 'Email address cannot exceed 150 characters.' });
        return;
      }

      // Check for email conflicts
      const existing = store.getUserByEmail(email.trim());
      if (existing && existing.id !== currentUser.id) {
        res.status(409).json({ success: false, error: 'A user with this email address already exists.' });
        return;
      }
    }

    // 4. Update store
    const updatedUser = store.updateUserProfile(currentUser.id, {
      name: name !== undefined ? name.trim() : undefined,
      jobTitle: jobTitle !== undefined ? (jobTitle ? jobTitle.trim() : '') : undefined,
      email: email !== undefined ? email.trim().toLowerCase() : undefined,
      avatar: avatar !== undefined ? avatar : undefined
    });

    if (!updatedUser) {
      res.status(404).json({ success: false, error: 'User record not found.' });
      return;
    }

    store.logAuditEvent({
      actorId: currentUser.id,
      actorName: updatedUser.name,
      workspaceId: req.authContext.workspaceId || 'ws_primary',
      action: 'PROFILE_UPDATED',
      result: 'SUCCESS',
      metadata: {
        previousName: currentUser.name,
        newName: updatedUser.name,
        jobTitle: updatedUser.jobTitle,
        email: updatedUser.email
      },
      correlationId: req.correlationId
    });

    // Retain current session RBAC role
    const responseUser = {
      ...updatedUser,
      role: req.authContext.memberRole || req.authContext.user.role || updatedUser.role
    };

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: responseUser
    });
  } catch (err: any) {
    Logger.error('Failed to update user profile', err);
    res.status(500).json({ success: false, error: 'An unexpected error occurred while updating profile.' });
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
