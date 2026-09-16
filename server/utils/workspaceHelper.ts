import { Request, Response } from 'express';
import { getSessionId } from '../api/connectionRoutes';

/**
 * Extracts authoritative active workspace id from the request.
 * Checks x-workspace-id header, query parameter, body workspaceId,
 * or authenticated context. Defaults to 'ws_primary'.
 */
export function getEffectiveWorkspaceId(req: Request): string {
  const headerWs = req.headers['x-workspace-id'];
  if (typeof headerWs === 'string' && headerWs.trim()) {
    return headerWs.trim();
  }
  const queryWs = req.query?.workspaceId;
  if (typeof queryWs === 'string' && queryWs.trim()) {
    return queryWs.trim();
  }
  if (req.body && typeof req.body.workspaceId === 'string' && req.body.workspaceId.trim()) {
    return req.body.workspaceId.trim();
  }
  if (req.authContext?.workspaceId) {
    return req.authContext.workspaceId;
  }
  return 'ws_primary';
}

/**
 * Extracts authoritative active project id from the request.
 * Checks x-project-id header, query parameter, body projectId,
 * or authenticated context.
 */
export function getEffectiveProjectId(req: Request): string | null {
  const headerProj = req.headers['x-project-id'];
  if (typeof headerProj === 'string' && headerProj.trim() && headerProj.trim() !== 'null' && headerProj.trim() !== 'undefined') {
    return headerProj.trim();
  }
  const queryProj = req.query?.projectId;
  if (typeof queryProj === 'string' && queryProj.trim() && queryProj.trim() !== 'null' && queryProj.trim() !== 'undefined') {
    return queryProj.trim();
  }
  if (req.body && typeof req.body.projectId === 'string' && req.body.projectId.trim() && req.body.projectId.trim() !== 'null' && req.body.projectId.trim() !== 'undefined') {
    return req.body.projectId.trim();
  }
  if (req.authContext?.projectId) {
    return req.authContext.projectId;
  }
  return null;
}

/**
 * Generates an isolated session + workspace + project storage key for datasets,
 * ensuring imported files and tables in workspace A / project A never leak.
 */
export function getSessionDatasetStoreKey(req: Request, res: Response): string {
  const sessionId = getSessionId(req, res);
  const workspaceId = getEffectiveWorkspaceId(req);
  const projectId = getEffectiveProjectId(req);
  return projectId ? `${sessionId}:${workspaceId}:${projectId}` : `${sessionId}:${workspaceId}`;
}
