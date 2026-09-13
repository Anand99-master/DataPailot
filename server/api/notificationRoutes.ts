import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

/**
 * GET /api/notifications
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const userId = req.authContext!.user.id;
    const wsId = req.query.workspaceId as string | undefined;
    const notifications = store.listNotifications(userId, wsId);
    res.json({ success: true, notifications });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve notifications.' });
  }
});

/**
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const userId = req.authContext!.user.id;
    const wsId = req.query.workspaceId as string | undefined;
    const count = store.getUnreadNotificationCount(userId, wsId);
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to count notifications.' });
  }
});

/**
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    store.markNotificationRead(req.params.id, req.authContext!.user.id);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to mark notification.' });
  }
});

/**
 * PUT /api/notifications/mark-all-read
 */
router.put('/mark-all-read', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const wsId = req.body.workspaceId as string | undefined;
    store.markAllNotificationsRead(req.authContext!.user.id, wsId);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to mark all notifications.' });
  }
});

export const notificationRoutes = router;
