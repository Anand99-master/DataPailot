import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

/**
 * GET /api/users/profile
 */
router.get('/profile', requireAuth, (req: Request, res: Response) => {
  res.json({ success: true, user: req.authContext!.user });
});

/**
 * PUT /api/users/profile
 */
router.put('/profile', requireAuth, (req: Request, res: Response) => {
  try {
    const { name, avatar } = req.body;
    const store = CollaborationStore.getInstance();
    const updated = store.updateUserProfile(req.authContext!.user.id, { name, avatar });

    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update user profile.' });
  }
});

/**
 * GET /api/users
 * List users (for adding members or assigning owners)
 */
router.get('/', requireAuth, (_req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const users = store.listAllUsers();
    // Strip any sensitive hashes
    const sanitized = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      status: u.status,
      role: u.role,
      createdAt: u.createdAt
    }));
    res.json({ success: true, users: sanitized });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to list users.' });
  }
});

/**
 * PUT /api/users/:userId/status
 */
router.put('/:userId/status', requireAuth, (req: Request, res: Response) => {
  try {
    if (req.authContext!.memberRole !== 'OWNER' && req.authContext!.memberRole !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Only administrators can modify user account status.' });
      return;
    }

    const { status } = req.body;
    if (status !== 'active' && status !== 'suspended') {
      res.status(400).json({ success: false, error: 'Invalid status.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    store.updateUserStatus(req.params.userId, status);
    res.json({ success: true, message: `User status updated to ${status}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update user status.' });
  }
});

export const userRoutes = router;
