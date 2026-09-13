import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth, requirePermission } from '../middleware/authMiddleware';

const router = Router();

/**
 * GET /api/activity
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const activities = store.listActivities(wsId, limit);
    res.json({ success: true, activities });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve activity feed.' });
  }
});

export const activityRoutes = router;
