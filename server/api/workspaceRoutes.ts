import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth, requirePermission, requireVerifiedEmail } from '../middleware/authMiddleware';
import { UserRole } from '../../src/types/collaboration';
import { Logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/workspaces
 * List workspaces accessible by current user
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const userId = req.authContext!.user.id;
    const workspaces = store.listWorkspacesForUser(userId);
    res.json({ success: true, workspaces });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve workspaces.' });
  }
});

/**
 * POST /api/workspaces
 * Create a new workspace
 */
router.post('/', requireAuth, requireVerifiedEmail, (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ success: false, error: 'A valid workspace name is required.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const userId = req.authContext!.user.id;
    const workspace = store.createWorkspace(name.trim(), description, userId);

    store.logActivity({
      actorId: userId,
      actorName: req.authContext!.user.name,
      action: 'CREATED_WORKSPACE',
      resourceType: 'workspace',
      resourceId: workspace.id,
      resourceName: workspace.name,
      workspaceId: workspace.id
    });

    store.logAuditEvent({
      actorId: userId,
      actorName: req.authContext!.user.name,
      workspaceId: workspace.id,
      action: 'WORKSPACE_CREATED',
      resourceType: 'workspace',
      resourceId: workspace.id,
      result: 'SUCCESS',
      metadata: { name: workspace.name },
      correlationId: req.correlationId
    });

    res.status(201).json({ success: true, workspace });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to create workspace.' });
  }
});

/**
 * GET /api/workspaces/:id
 */
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const workspace = store.getWorkspaceById(req.params.id);
    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found.' });
      return;
    }

    const member = store.getWorkspaceMember(workspace.id, req.authContext!.user.id);
    if (!member) {
      res.status(403).json({ success: false, error: 'You are not a member of this workspace.' });
      return;
    }

    res.json({ success: true, workspace });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to get workspace.' });
  }
});

/**
 * PUT /api/workspaces/:id
 */
router.put('/:id', requireAuth, requirePermission('workspace.update'), (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const store = CollaborationStore.getInstance();
    const updated = store.updateWorkspace(req.params.id, { name, description });

    if (!updated) {
      res.status(404).json({ success: false, error: 'Workspace not found.' });
      return;
    }

    store.logActivity({
      actorId: req.authContext!.user.id,
      actorName: req.authContext!.user.name,
      action: 'UPDATED_WORKSPACE',
      resourceType: 'workspace',
      resourceId: updated.id,
      resourceName: updated.name,
      workspaceId: updated.id
    });

    res.json({ success: true, workspace: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update workspace.' });
  }
});

/**
 * DELETE /api/workspaces/:id
 */
router.delete('/:id', requireAuth, requirePermission('workspace.delete'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const workspace = store.getWorkspaceById(req.params.id);
    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found.' });
      return;
    }

    if (workspace.ownerId !== req.authContext!.user.id) {
      res.status(403).json({ success: false, error: 'Only the workspace owner can archive or delete this workspace.' });
      return;
    }

    store.archiveWorkspace(req.params.id);

    store.logAuditEvent({
      actorId: req.authContext!.user.id,
      actorName: req.authContext!.user.name,
      workspaceId: req.params.id,
      action: 'WORKSPACE_ARCHIVED',
      result: 'SUCCESS',
      metadata: {},
      correlationId: req.correlationId
    });

    res.json({ success: true, message: 'Workspace archived successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to archive workspace.' });
  }
});

/**
 * GET /api/workspaces/:id/members
 */
router.get('/:id/members', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const members = store.listWorkspaceMembers(req.params.id);
    res.json({ success: true, members });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve workspace members.' });
  }
});

/**
 * POST /api/workspaces/:id/members
 * Invite or add member
 */
router.post('/:id/members', requireAuth, requirePermission('member.invite'), (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;
    if (!email || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'A valid email address is required.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    let targetUser = store.getUserByEmail(email);

    // If user does not exist yet, create an invited user account
    if (!targetUser) {
      const name = email.split('@')[0].replace(/[._]/g, ' ');
      const dummyAuth = CollaborationStore.hashPassword('WelcomeDataPilot123!');
      targetUser = store.createUser({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email,
        password: 'WelcomeDataPilot123!',
        role: (role as UserRole) || 'ANALYST'
      }) as any;
    }

    const assignedRole: UserRole = role || 'ANALYST';
    const member = store.addOrInviteMember(req.params.id, targetUser!.id, assignedRole);

    // Notify the target user
    store.createNotification({
      userId: targetUser!.id,
      workspaceId: req.params.id,
      type: 'workspace_invitation',
      title: 'Added to Workspace',
      message: `${req.authContext!.user.name} added you to workspace with the role [${assignedRole}].`,
      metadata: { invitedBy: req.authContext!.user.id, role: assignedRole }
    });

    store.logActivity({
      actorId: req.authContext!.user.id,
      actorName: req.authContext!.user.name,
      action: 'INVITED_MEMBER',
      resourceType: 'member',
      resourceId: member.id,
      resourceName: targetUser!.name,
      workspaceId: req.params.id,
      metadata: { role: assignedRole, email }
    });

    store.logAuditEvent({
      actorId: req.authContext!.user.id,
      actorName: req.authContext!.user.name,
      workspaceId: req.params.id,
      action: 'MEMBER_INVITED',
      resourceType: 'member',
      resourceId: member.id,
      result: 'SUCCESS',
      metadata: { email, role: assignedRole },
      correlationId: req.correlationId
    });

    res.status(201).json({ success: true, member });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to add workspace member.' });
  }
});

/**
 * PUT /api/workspaces/:id/members/:memberId
 * Change role
 */
router.put('/:id/members/:memberId', requireAuth, requirePermission('member.update'), (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    if (!role) {
      res.status(400).json({ success: false, error: 'Role is required.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const ws = store.getWorkspaceById(req.params.id);
    if (!ws) {
      res.status(404).json({ success: false, error: 'Workspace not found.' });
      return;
    }

    const members = store.listWorkspaceMembers(req.params.id);
    const targetMember = members.find(m => m.id === req.params.memberId);
    if (!targetMember) {
      res.status(404).json({ success: false, error: 'Workspace member record not found.' });
      return;
    }

    // Protection: User cannot change their own role
    if (targetMember.userId === req.authContext!.user.id) {
      res.status(403).json({ success: false, error: 'Users cannot change their own workspace role.' });
      return;
    }

    // Protection: Only OWNER can change roles to/from OWNER or promote to OWNER
    if (targetMember.role === 'OWNER' && req.authContext!.memberRole !== 'OWNER') {
      res.status(403).json({ success: false, error: 'Only the workspace owner can modify owner roles.' });
      return;
    }

    if (role === 'OWNER' && req.authContext!.memberRole !== 'OWNER') {
      res.status(403).json({ success: false, error: 'Only current workspace owner can transfer or assign OWNER role.' });
      return;
    }

    const updated = store.updateMemberRole(req.params.id, req.params.memberId, role as UserRole);

    // Notify member
    store.createNotification({
      userId: targetMember.userId,
      workspaceId: req.params.id,
      type: 'role_changed',
      title: 'Workspace Role Updated',
      message: `Your role was updated to [${role}] by ${req.authContext!.user.name}.`,
      metadata: { newRole: role }
    });

    store.logAuditEvent({
      actorId: req.authContext!.user.id,
      actorName: req.authContext!.user.name,
      workspaceId: req.params.id,
      action: 'MEMBER_ROLE_CHANGED',
      resourceType: 'member',
      resourceId: req.params.memberId,
      result: 'SUCCESS',
      metadata: { targetUserId: targetMember.userId, newRole: role },
      correlationId: req.correlationId
    });

    res.json({ success: true, member: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update member role.' });
  }
});

/**
 * DELETE /api/workspaces/:id/members/:memberId
 */
router.delete('/:id/members/:memberId', requireAuth, requirePermission('member.remove'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const ws = store.getWorkspaceById(req.params.id);
    if (!ws) {
      res.status(404).json({ success: false, error: 'Workspace not found.' });
      return;
    }

    const members = store.listWorkspaceMembers(req.params.id);
    const targetMember = members.find(m => m.id === req.params.memberId);
    if (!targetMember) {
      res.status(404).json({ success: false, error: 'Member not found.' });
      return;
    }

    // Protection: Cannot remove workspace owner
    if (targetMember.userId === ws.ownerId || targetMember.role === 'OWNER') {
      res.status(400).json({ success: false, error: 'Cannot remove the workspace owner.' });
      return;
    }

    store.removeWorkspaceMember(req.params.id, req.params.memberId);

    store.logAuditEvent({
      actorId: req.authContext!.user.id,
      actorName: req.authContext!.user.name,
      workspaceId: req.params.id,
      action: 'MEMBER_REMOVED',
      resourceType: 'member',
      resourceId: req.params.memberId,
      result: 'SUCCESS',
      metadata: { removedUserId: targetMember.userId },
      correlationId: req.correlationId
    });

    res.json({ success: true, message: 'Member removed from workspace.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to remove workspace member.' });
  }
});

export const workspaceRoutes = router;
