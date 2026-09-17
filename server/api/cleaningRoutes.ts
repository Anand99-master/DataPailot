import { Router, Request, Response } from 'express';
import { getSessionId } from './connectionRoutes';
import { getSessionDatasetStoreKey } from '../utils/workspaceHelper';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';
import { DataCleaningService } from '../services/DataCleaningService';
import { AiCleaningService } from '../ai/AiCleaningService';
import { ExportFormat } from '../../src/types/import';
import { requireAuth, requirePermission } from '../middleware/authMiddleware';

export const cleaningRoutes = Router();

/**
 * GET /api/cleaning/source/:datasetId
 * Fetches schema, sample preview rows, and metadata for any cleaning source (imported dataset or database table)
 */
cleaningRoutes.get('/source/:datasetId', async (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const { datasetId } = req.params;

    if (!datasetId) {
      ApiResponse.error(res, 400, 'MISSING_DATASET_ID', 'datasetId is required.');
      return;
    }

    const source = await DataCleaningService.getSourceInfo(storeKey, datasetId);

    const dataset = {
      datasetId: source.datasetId,
      workspaceId: source.workspaceId,
      projectId: source.projectId,
      sourceType: source.sourceType,
      sourceName: source.name,
      fileType: source.fileType,
      rowCount: source.totalRows,
      columns: source.columns,
      schema: source.schema,
      name: source.name,
      tableName: source.tableName,
      previewRows: source.rows.slice(0, 50),
      importTimestamp: new Date().toISOString(),
      status: 'ready' as const,
      profile: source.profile,
      sourceDatabaseType: source.sourceDatabaseType,
      sourceConnectionId: source.sourceConnectionId,
      sourceSchema: source.sourceSchema,
      sourceTable: source.sourceTable
    };

    res.json({
      success: true,
      dataset
    });
  } catch (err: any) {
    Logger.error('Failed to load cleaning data source', err);
    ApiResponse.error(res, 404, 'SOURCE_NOT_FOUND', err.message || 'Failed to load cleaning data source.');
  }
});

/**
 * POST /api/cleaning/ai/analyze
 * Generates grounded AI recommendations for cleaning and transforming a dataset
 */
cleaningRoutes.post('/ai/analyze', async (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const { datasetId, steps } = req.body;

    if (!datasetId) {
      ApiResponse.error(res, 400, 'MISSING_DATASET_ID', 'datasetId is required.');
      return;
    }

    const plan = await AiCleaningService.analyzeDataset(
      storeKey,
      datasetId,
      Array.isArray(steps) ? steps : []
    );

    res.json({
      success: true,
      plan
    });
  } catch (err: any) {
    Logger.error('AI cleaning analysis failed', err);
    ApiResponse.error(res, 500, 'AI_ANALYSIS_FAILED', err.message || 'Failed to analyze dataset for AI recommendations.');
  }
});

/**
 * POST /api/cleaning/ai/reanalyze
 * Re-analyzes dataset after pipeline modifications, returning remaining issues and estimated improvements
 */
cleaningRoutes.post('/ai/reanalyze', async (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const { datasetId, steps } = req.body;

    if (!datasetId) {
      ApiResponse.error(res, 400, 'MISSING_DATASET_ID', 'datasetId is required.');
      return;
    }

    const result = await AiCleaningService.reanalyzeDataset(
      storeKey,
      datasetId,
      Array.isArray(steps) ? steps : []
    );

    res.json({
      success: true,
      result
    });
  } catch (err: any) {
    Logger.error('AI cleaning re-analysis failed', err);
    ApiResponse.error(res, 500, 'AI_REANALYSIS_FAILED', err.message || 'Failed to re-analyze dataset.');
  }
});

/**
 * POST /api/cleaning/preview
 * Previews the effect of transformation steps on a dataset with before/after stats and DQ scores
 */
cleaningRoutes.post('/preview', async (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const { datasetId, steps } = req.body;

    if (!datasetId) {
      ApiResponse.error(res, 400, 'MISSING_DATASET_ID', 'datasetId is required.');
      return;
    }

    const preview = await DataCleaningService.previewPipeline(
      storeKey,
      datasetId,
      Array.isArray(steps) ? steps : []
    );

    res.json({
      success: true,
      preview
    });
  } catch (err: any) {
    Logger.error('Cleaning pipeline preview failed', err);
    ApiResponse.error(res, 400, 'PREVIEW_FAILED', err.message || 'Failed to preview cleaning pipeline.');
  }
});

/**
 * POST /api/cleaning/save
 * Applies the transformation pipeline and saves as a brand new versioned dataset in Unified Data Layer
 */
cleaningRoutes.post('/save', requireAuth, requirePermission('pipeline.create'), async (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const { datasetId, newDatasetName, steps, pipelineMetadata } = req.body;

    if (!datasetId) {
      ApiResponse.error(res, 400, 'MISSING_DATASET_ID', 'datasetId is required.');
      return;
    }

    const result = await DataCleaningService.saveCleanedDataset(
      storeKey,
      datasetId,
      newDatasetName,
      Array.isArray(steps) ? steps : [],
      pipelineMetadata
    );

    res.json({
      success: true,
      result
    });
  } catch (err: any) {
    Logger.error('Saving cleaned dataset failed', err);
    ApiResponse.error(res, 500, 'SAVE_FAILED', err.message || 'Failed to save cleaned dataset.');
  }
});

/**
 * POST /api/cleaning/export
 * Exports cleaned data to CSV, JSON, or XLSX format with formula protection
 */
cleaningRoutes.post('/export', async (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const { datasetId, steps, format, customName } = req.body;

    if (!datasetId) {
      ApiResponse.error(res, 400, 'MISSING_DATASET_ID', 'datasetId is required.');
      return;
    }

    const exportFormat = (format || 'csv').toLowerCase() as ExportFormat;
    if (!['csv', 'json', 'xlsx'].includes(exportFormat)) {
      ApiResponse.error(res, 400, 'INVALID_FORMAT', 'Supported formats are csv, json, xlsx.');
      return;
    }

    const exported = await DataCleaningService.exportCleanedData(
      storeKey,
      datasetId,
      Array.isArray(steps) ? steps : [],
      exportFormat,
      customName
    );

    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);

    if (Buffer.isBuffer(exported.content)) {
      res.send(exported.content);
    } else {
      res.send(exported.content);
    }
  } catch (err: any) {
    Logger.error('Cleaned dataset export failed', err);
    ApiResponse.error(res, 500, 'EXPORT_FAILED', err.message || 'Failed to export cleaned data.');
  }
});
