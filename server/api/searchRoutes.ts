import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

/**
 * GET /api/search
 * Search across projects, queries, dashboards, reports, and datasets within the active workspace
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    if (!q || q.trim().length === 0) {
      res.json({ success: true, results: [] });
      return;
    }

    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const results = store.globalSearch(wsId, q);

    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Search operation failed.' });
  }
});

export const searchRoutes = router;
