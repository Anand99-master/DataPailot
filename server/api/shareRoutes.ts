import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth } from '../middleware/authMiddleware';
import { ResourceType, ShareAccessLevel } from '../../src/types/collaboration';

const router = Router();

/**
 * GET /api/shares/:resourceType/:resourceId
 */
router.get('/:resourceType/:resourceId', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const { resourceType, resourceId } = req.params;
    const shares = store.getResourceShares(resourceType as ResourceType, resourceId);
    res.json({ success: true, shares });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve shares.' });
  }
});

/**
 * POST /api/shares
 * Grant or update direct resource share with a user
 */
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const { resourceType, resourceId, sharedWithUserId, accessLevel } = req.body;
    if (!resourceType || !resourceId || !sharedWithUserId || !accessLevel) {
      res.status(400).json({ success: false, error: 'Missing required sharing parameters.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const userId = req.authContext!.user.id;

    // Check that target user is a member of this workspace
    const targetMember = store.getWorkspaceMember(wsId, sharedWithUserId);
    if (!targetMember) {
      res.status(400).json({ success: false, error: 'User is not a member of the current workspace.' });
      return;
    }

    const share = store.addOrUpdateShare({
      resourceType: resourceType as ResourceType,
      resourceId,
      workspaceId: wsId,
      sharedWithUserId,
      accessLevel: accessLevel as ShareAccessLevel,
      sharedByUserId: userId
    });

    // Notify user
    store.createNotification({
      userId: sharedWithUserId,
      workspaceId: wsId,
      type: 'resource_shared',
      title: 'Resource Shared With You',
      message: `${req.authContext!.user.name} shared a ${resourceType} with [${accessLevel}] access.`,
      metadata: { resourceType, resourceId, accessLevel }
    });

    store.logAuditEvent({
      actorId: userId,
      actorName: req.authContext!.user.name,
      workspaceId: wsId,
      action: 'RESOURCE_SHARED',
      resourceType,
      resourceId,
      result: 'SUCCESS',
      metadata: { sharedWithUserId, accessLevel },
      correlationId: req.correlationId
    });

    res.status(201).json({ success: true, share });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to share resource.' });
  }
});

/**
 * DELETE /api/shares/:shareId
 */
router.delete('/:shareId', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    store.removeShare(req.params.shareId);
    res.json({ success: true, message: 'Share revoked successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to revoke share.' });
  }
});

export const shareRoutes = router;
