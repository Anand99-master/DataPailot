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
    const rawProjId = (req.query.projectId as string) || (req.headers['x-project-id'] as string) || req.authContext?.projectId;
    const projectId = rawProjId && rawProjId !== 'null' && rawProjId !== 'undefined' ? rawProjId.trim() : undefined;
    const activities = store.listActivities(wsId, limit, projectId);
    res.json({ success: true, activities });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve activity feed.' });
  }
});

export const activityRoutes = router;
