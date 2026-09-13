import { Router, Request, Response } from 'express';
import { DataQualityService } from '../services/DataQualityService';
import { getSessionId } from './connectionRoutes';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';

export const qualityRoutes = Router();

qualityRoutes.get('/profile/:schema/:table', async (req: Request, res: Response) => {
  const sessionId = getSessionId(req, res);
  const { schema, table } = req.params;
  const isImported = schema === 'imported' || schema === 'file';

  try {
    const profile = await DataQualityService.profile(sessionId, schema, table, isImported);
    res.json({ success: true, profile });
  } catch (err: any) {
    Logger.error('Failed to profile table data quality', err, { sessionId, schema, table });
    ApiResponse.error(res, 500, 'QUALITY_PROFILING_FAILED', err.message);
  }
});
