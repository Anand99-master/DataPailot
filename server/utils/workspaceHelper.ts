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
 * Generates an isolated session + workspace storage key for datasets,
 * ensuring imported files and tables in workspace A never leak to workspace B.
 */
export function getSessionDatasetStoreKey(req: Request, res: Response): string {
  const sessionId = getSessionId(req, res);
  const workspaceId = getEffectiveWorkspaceId(req);
  return `${sessionId}:${workspaceId}`;
}
