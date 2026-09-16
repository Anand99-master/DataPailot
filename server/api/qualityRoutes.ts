import { Router, Request, Response } from 'express';
import { DataQualityService } from '../services/DataQualityService';
import { getSessionId } from './connectionRoutes';
import { getSessionDatasetStoreKey } from '../utils/workspaceHelper';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';

export const qualityRoutes = Router();

qualityRoutes.get('/profile/:schema/:table', async (req: Request, res: Response) => {
  const sessionId = getSessionId(req, res);
  const storeKey = getSessionDatasetStoreKey(req, res);
  const { schema, table } = req.params;
  const isImported = schema === 'imported' || schema === 'file';

  try {
    // For imported datasets, pass the workspace/project-scoped storeKey; for live DB connections, pass sessionId
    const targetKey = isImported ? storeKey : sessionId;
    const profile = await DataQualityService.profile(targetKey, schema, table, isImported);
    res.json({ success: true, profile });
  } catch (err: any) {
    Logger.error('Failed to profile table data quality', err, { sessionId, storeKey, schema, table });
    ApiResponse.error(res, 500, 'QUALITY_PROFILING_FAILED', err.message || 'Failed to generate data quality profile.');
  }
});
