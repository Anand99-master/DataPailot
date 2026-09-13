import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth, requirePermission } from '../middleware/authMiddleware';

const router = Router();

/**
 * GET /api/audit/logs
 * Retrieve audit logs with filtering (Protected by audit.read permission)
 */
router.get('/logs', requireAuth, requirePermission('audit.read'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const actorId = req.query.actorId as string | undefined;
    const action = req.query.action as string | undefined;
    const result = req.query.result as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const logs = store.listAuditLogs({
      workspaceId: wsId,
      actorId,
      action,
      result,
      limit
    });

    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve audit logs.' });
  }
});

export const auditRoutes = router;
