import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth, requirePermission, requireVerifiedEmail } from '../middleware/authMiddleware';

const router = Router();

/**
 * GET /api/projects
 * List projects in current workspace
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const projects = store.listProjects(wsId);
    res.json({ success: true, projects });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve projects.' });
  }
});

/**
 * POST /api/projects
 */
router.post('/', requireAuth, requireVerifiedEmail, (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Valid project name is required.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const userId = req.authContext!.user.id;

    const project = store.createProject(wsId, name.trim(), description, userId);

    store.logActivity({
      actorId: userId,
      actorName: req.authContext!.user.name,
      action: 'CREATED_PROJECT',
      resourceType: 'project',
      resourceId: project.id,
      resourceName: project.name,
      workspaceId: wsId,
      projectId: project.id
    });

    res.status(201).json({ success: true, project });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to create project.' });
  }
});

/**
 * GET /api/projects/:id
 */
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const project = store.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found.' });
      return;
    }

    if (project.workspaceId !== req.authContext!.workspaceId) {
      res.status(403).json({ success: false, error: 'Cannot access project from another workspace.' });
      return;
    }

    res.json({ success: true, project });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to get project.' });
  }
});

/**
 * PUT /api/projects/:id
 */
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const store = CollaborationStore.getInstance();
    const project = store.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found.' });
      return;
    }

    if (project.workspaceId !== req.authContext!.workspaceId) {
      res.status(403).json({ success: false, error: 'Cannot modify project from another workspace.' });
      return;
    }

    const updated = store.updateProject(req.params.id, { name, description });
    res.json({ success: true, project: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update project.' });
  }
});

/**
 * DELETE /api/projects/:id
 */
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const project = store.getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found.' });
      return;
    }

    if (project.workspaceId !== req.authContext!.workspaceId) {
      res.status(403).json({ success: false, error: 'Cannot delete project from another workspace.' });
      return;
    }

    store.deleteProject(req.params.id);
    res.json({ success: true, message: 'Project deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete project.' });
  }
});

export const projectRoutes = router;
