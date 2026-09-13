import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth, requirePermission } from '../middleware/authMiddleware';
import { AccessControlService } from '../services/AccessControlService';

const router = Router();

// ==========================================
// SAVED QUERIES COLLABORATION API
// ==========================================
router.get('/queries', requireAuth, requirePermission('query.read'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const projectId = req.query.projectId as string | undefined;
    const queries = store.listSavedQueries(wsId, projectId);
    res.json({ success: true, queries });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to list saved queries.' });
  }
});

router.post('/queries', requireAuth, requirePermission('query.create'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const userId = req.authContext!.user.id;
    const { id, name, query, description, tags, isFavorite, visibility, projectId } = req.body;

    if (!name || !query) {
      res.status(400).json({ success: false, error: 'Query name and SQL are required.' });
      return;
    }

    const saved = store.saveQuery({
      id,
      workspaceId: wsId,
      projectId,
      ownerId: userId,
      name,
      query,
      description,
      tags,
      isFavorite,
      visibility
    });

    store.logActivity({
      actorId: userId,
      actorName: req.authContext!.user.name,
      action: id ? 'UPDATED_QUERY' : 'SAVED_QUERY',
      resourceType: 'query',
      resourceId: saved.id,
      resourceName: saved.name,
      workspaceId: wsId,
      projectId
    });

    res.status(201).json({ success: true, query: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to save query.' });
  }
});

router.delete('/queries/:id', requireAuth, requirePermission('query.delete'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const query = store.getSavedQueryById(req.params.id);
    if (!query) {
      res.status(404).json({ success: false, error: 'Query not found.' });
      return;
    }

    const authCheck = AccessControlService.getInstance().authorizeResource({
      userId: req.authContext!.user.id,
      workspaceId: req.authContext!.workspaceId,
      resourceType: 'query',
      resourceId: query.id,
      resourceOwnerId: query.ownerId,
      resourceWorkspaceId: query.workspaceId,
      resourceVisibility: query.visibility,
      action: 'delete'
    });

    if (!authCheck.authorized) {
      res.status(403).json({ success: false, error: authCheck.reason || 'Permission denied.' });
      return;
    }

    store.deleteSavedQuery(req.params.id);
    res.json({ success: true, message: 'Saved query deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete saved query.' });
  }
});

// ==========================================
// DASHBOARDS COLLABORATION API
// ==========================================
router.get('/dashboards', requireAuth, requirePermission('dashboard.read'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const projectId = req.query.projectId as string | undefined;
    const dashboards = store.listDashboards(wsId, projectId);
    res.json({ success: true, dashboards });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to list dashboards.' });
  }
});

router.get('/dashboards/:id', requireAuth, requirePermission('dashboard.read'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const dashboard = store.getDashboardById(req.params.id);
    if (!dashboard) {
      res.status(404).json({ success: false, error: 'Dashboard not found.' });
      return;
    }

    if (dashboard.workspaceId !== req.authContext!.workspaceId) {
      res.status(403).json({ success: false, error: 'Cannot access dashboard from another workspace.' });
      return;
    }

    res.json({ success: true, dashboard });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to get dashboard.' });
  }
});

router.post('/dashboards', requireAuth, requirePermission('dashboard.create'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const userId = req.authContext!.user.id;
    const { id, title, description, widgets, filters, layout, visibility, autoRefreshInterval, projectId } = req.body;

    if (!title) {
      res.status(400).json({ success: false, error: 'Dashboard title is required.' });
      return;
    }

    const saved = store.saveDashboard({
      id,
      workspaceId: wsId,
      projectId,
      ownerId: userId,
      title,
      description,
      widgets: widgets || [],
      filters: filters || [],
      layout: layout || { columns: 12, gap: 'md' },
      visibility,
      autoRefreshInterval
    });

    store.logActivity({
      actorId: userId,
      actorName: req.authContext!.user.name,
      action: id ? 'UPDATED_DASHBOARD' : 'CREATED_DASHBOARD',
      resourceType: 'dashboard',
      resourceId: saved.id,
      resourceName: saved.title,
      workspaceId: wsId,
      projectId
    });

    res.status(201).json({ success: true, dashboard: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to save dashboard.' });
  }
});

router.delete('/dashboards/:id', requireAuth, requirePermission('dashboard.delete'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const dashboard = store.getDashboardById(req.params.id);
    if (!dashboard) {
      res.status(404).json({ success: false, error: 'Dashboard not found.' });
      return;
    }

    const authCheck = AccessControlService.getInstance().authorizeResource({
      userId: req.authContext!.user.id,
      workspaceId: req.authContext!.workspaceId,
      resourceType: 'dashboard',
      resourceId: dashboard.id,
      resourceOwnerId: dashboard.ownerId,
      resourceWorkspaceId: dashboard.workspaceId,
      resourceVisibility: dashboard.visibility,
      action: 'delete'
    });

    if (!authCheck.authorized) {
      res.status(403).json({ success: false, error: authCheck.reason || 'Permission denied.' });
      return;
    }

    store.deleteDashboard(req.params.id);
    res.json({ success: true, message: 'Dashboard deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete dashboard.' });
  }
});

export const collaborationResourceRoutes = router;
