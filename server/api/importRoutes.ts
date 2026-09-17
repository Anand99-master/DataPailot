import { Router, Request, Response } from 'express';
import { getSessionId } from './connectionRoutes';
import { getSessionDatasetStoreKey, getEffectiveWorkspaceId } from '../utils/workspaceHelper';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';
import { ImportSecurity } from '../import/ImportSecurity';
import { CsvParser } from '../import/CsvParser';
import { ExcelParser } from '../import/ExcelParser';
import { JsonParser } from '../import/JsonParser';
import { UnifiedDataLayer } from '../import/UnifiedDataLayer';
import { ExportFormat } from '../../src/types/import';
import { requireAuth, requirePermission } from '../middleware/authMiddleware';

export const importRoutes = Router();
const unifiedDataLayer = UnifiedDataLayer.getInstance();

/**
 * POST /api/import/validate-and-preview
 * Validates the uploaded file and generates a first-50-row preview and sheet list
 */
importRoutes.post('/validate-and-preview', async (req: Request, res: Response) => {
  try {
    const { fileName, mimeType, fileSize, contentText, contentBase64, selectedSheet } = req.body;

    if (!fileName) {
      ApiResponse.error(res, 400, 'MISSING_FILE_NAME', 'File name is required.');
      return;
    }

    // Security checks
    const extCheck = ImportSecurity.validateExtension(fileName);
    if (!extCheck.isValid) {
      ApiResponse.error(res, 400, 'INVALID_EXTENSION', extCheck.error!);
      return;
    }

    const mimeCheck = ImportSecurity.validateMimeType(mimeType);
    if (!mimeCheck.isValid) {
      ApiResponse.error(res, 400, 'INVALID_MIME_TYPE', mimeCheck.error!);
      return;
    }

    // Determine content buffer or string
    let buffer: Buffer | null = null;
    let textContent: string = contentText || '';

    if (contentBase64) {
      buffer = Buffer.from(contentBase64, 'base64');
    } else if (contentText) {
      buffer = Buffer.from(contentText, 'utf8');
    }

    if (!buffer || buffer.length === 0) {
      ApiResponse.error(res, 400, 'EMPTY_FILE', 'Uploaded file is empty.');
      return;
    }

    const effectiveSize = fileSize || buffer.length;
    const sizeCheck = ImportSecurity.validateFileSize(effectiveSize);
    if (!sizeCheck.isValid) {
      ApiResponse.error(res, 413, 'FILE_TOO_LARGE', sizeCheck.error!);
      return;
    }

    const fileType = extCheck.fileType!;
    const sanitizedFileName = ImportSecurity.sanitizeFileName(fileName);

    let previewRows: Record<string, unknown>[] = [];
    let columns: any[] = [];
    let totalRows = 0;
    let sheets: string[] | undefined;
    let warnings: string[] = [];

    if (fileType === 'CSV') {
      const parsed = CsvParser.parse(buffer.toString('utf8'), {
        maxRows: ImportSecurity.MAX_PREVIEW_ROWS,
        previewOnly: true
      });
      previewRows = parsed.rows;
      columns = parsed.columns;
      totalRows = parsed.totalRows;
      warnings = parsed.warnings;
    } else if (fileType === 'XLSX') {
      sheets = ExcelParser.getSheetNames(buffer);
      const parsed = ExcelParser.parse(buffer, {
        sheetName: selectedSheet,
        maxRows: ImportSecurity.MAX_PREVIEW_ROWS,
        previewOnly: true
      });
      previewRows = parsed.rows;
      columns = parsed.columns;
      totalRows = parsed.totalRows;
      warnings = parsed.warnings;
    } else if (fileType === 'JSON') {
      const parsed = JsonParser.parse(buffer.toString('utf8'), {
        maxRows: ImportSecurity.MAX_PREVIEW_ROWS,
        previewOnly: true
      });
      previewRows = parsed.rows;
      columns = parsed.columns;
      totalRows = parsed.totalRows;
      warnings = parsed.warnings;
    }

    res.json({
      success: true,
      isValid: true,
      fileName: sanitizedFileName,
      fileType,
      fileSize: effectiveSize,
      rowCount: totalRows,
      columnCount: columns.length,
      sheets,
      selectedSheet: selectedSheet || (sheets && sheets[0]),
      columns,
      previewRows,
      warnings
    });
  } catch (err: any) {
    Logger.error('File validation and preview failed', err);
    ApiResponse.error(res, 400, 'PREVIEW_FAILED', err.message || 'Failed to parse file preview.');
  }
});

/**
 * POST /api/import/confirm
 * Fully parses, profiles, and registers the imported dataset in the Unified Data Layer
 */
importRoutes.post('/confirm', requireAuth, requirePermission('dataset.create'), async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req, res);
    const {
      fileName,
      datasetName,
      fileType,
      contentText,
      contentBase64,
      selectedSheet
    } = req.body;

    if (!fileName) {
      ApiResponse.error(res, 400, 'MISSING_FILE_NAME', 'File name is required.');
      return;
    }

    let buffer: Buffer | null = null;
    if (contentBase64) {
      buffer = Buffer.from(contentBase64, 'base64');
    } else if (contentText) {
      buffer = Buffer.from(contentText, 'utf8');
    }

    if (!buffer || buffer.length === 0) {
      ApiResponse.error(res, 400, 'EMPTY_FILE', 'File content is empty.');
      return;
    }

    const effectiveType = fileType || ImportSecurity.validateExtension(fileName).fileType;
    if (!effectiveType) {
      ApiResponse.error(res, 400, 'INVALID_FILE_TYPE', 'Unsupported file type.');
      return;
    }

    const name = datasetName?.trim() || ImportSecurity.sanitizeFileName(fileName);

    let parsedRows: Record<string, unknown>[] = [];
    let columns: any[] = [];
    let sheets: string[] | undefined;

    if (effectiveType === 'CSV') {
      const parsed = CsvParser.parse(buffer.toString('utf8'), {
        maxRows: ImportSecurity.MAX_IMPORT_ROWS
      });
      parsedRows = parsed.rows;
      columns = parsed.columns;
    } else if (effectiveType === 'XLSX') {
      sheets = ExcelParser.getSheetNames(buffer);
      const parsed = ExcelParser.parse(buffer, {
        sheetName: selectedSheet,
        maxRows: ImportSecurity.MAX_IMPORT_ROWS
      });
      parsedRows = parsed.rows;
      columns = parsed.columns;
    } else if (effectiveType === 'JSON') {
      const parsed = JsonParser.parse(buffer.toString('utf8'), {
        maxRows: ImportSecurity.MAX_IMPORT_ROWS
      });
      parsedRows = parsed.rows;
      columns = parsed.columns;
    }

    const storeKey = getSessionDatasetStoreKey(req, res);
    const workspaceId = getEffectiveWorkspaceId(req);

    const dataset = await unifiedDataLayer.registerDataset(storeKey, {
      sourceName: name,
      fileType: effectiveType,
      columns,
      rows: parsedRows,
      fileSize: buffer.length,
      sheets,
      selectedSheet,
      workspaceId
    });

    res.json({
      success: true,
      dataset
    });
  } catch (err: any) {
    Logger.error('Dataset confirmation failed', err);
    ApiResponse.error(res, 500, 'IMPORT_FAILED', err.message || 'Failed to import dataset.');
  }
});

/**
 * GET /api/import/datasets
 * Retrieves all imported datasets for the session
 */
importRoutes.get('/datasets', (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const datasets = unifiedDataLayer.getDatasets(storeKey);
    res.json({
      success: true,
      datasets,
      count: datasets.length
    });
  } catch (err: any) {
    Logger.error('Failed to list imported datasets', err);
    ApiResponse.error(res, 500, 'LIST_DATASETS_FAILED', err.message);
  }
});

/**
 * GET /api/import/datasets/:id
 * Retrieves dataset details, preview, and statistical profile
 */
importRoutes.get('/datasets/:id', (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const dataset = unifiedDataLayer.getDataset(storeKey, req.params.id);
    if (!dataset) {
      ApiResponse.error(res, 404, 'DATASET_NOT_FOUND', `Dataset '${req.params.id}' not found.`);
      return;
    }
    res.json({
      success: true,
      dataset
    });
  } catch (err: any) {
    Logger.error('Failed to get dataset details', err);
    ApiResponse.error(res, 500, 'GET_DATASET_FAILED', err.message);
  }
});

/**
 * PATCH /api/import/datasets/:id
 * Renames an imported dataset
 */
importRoutes.patch('/datasets/:id', (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const { name } = req.body;
    if (!name || !name.trim()) {
      ApiResponse.error(res, 400, 'INVALID_NAME', 'New name cannot be empty.');
      return;
    }
    const updated = unifiedDataLayer.renameDataset(storeKey, req.params.id, name);
    res.json({
      success: true,
      dataset: updated
    });
  } catch (err: any) {
    Logger.error('Failed to rename dataset', err);
    ApiResponse.error(res, 400, 'RENAME_FAILED', err.message);
  }
});

/**
 * DELETE /api/import/datasets/:id
 * Removes an imported dataset
 */
importRoutes.delete('/datasets/:id', (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const success = unifiedDataLayer.removeDataset(storeKey, req.params.id);
    if (!success) {
      ApiResponse.error(res, 404, 'DATASET_NOT_FOUND', `Dataset '${req.params.id}' not found.`);
      return;
    }
    res.json({
      success: true,
      message: 'Dataset deleted successfully.'
    });
  } catch (err: any) {
    Logger.error('Failed to delete dataset', err);
    ApiResponse.error(res, 500, 'DELETE_FAILED', err.message);
  }
});

/**
 * POST /api/import/query
 * Executes a read-only analytical query on imported datasets
 */
importRoutes.post('/query', async (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const { sql, maxRows } = req.body;

    if (!sql || typeof sql !== 'string') {
      ApiResponse.error(res, 400, 'MISSING_SQL', 'SQL query is required.');
      return;
    }

    const result = await unifiedDataLayer.executeQuery(storeKey, sql, { maxRows });
    res.json({
      success: true,
      result
    });
  } catch (err: any) {
    Logger.error('Query on imported dataset failed', err);
    ApiResponse.error(res, 400, 'QUERY_FAILED', err.message);
  }
});

/**
 * GET /api/import/capabilities
 * Returns support matrix for analytical operations on imported datasets
 */
importRoutes.get('/capabilities', (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const capabilities = unifiedDataLayer.getOperationCapabilities(storeKey);
    res.json({
      success: true,
      capabilities
    });
  } catch (err: any) {
    Logger.error('Failed to get capabilities', err);
    ApiResponse.error(res, 500, 'CAPABILITIES_FAILED', err.message);
  }
});

/**
 * POST /api/import/export
 * Exports an imported dataset to CSV, JSON, or XLSX format with formula injection protection
 */
importRoutes.post('/export', (req: Request, res: Response) => {
  try {
    const storeKey = getSessionDatasetStoreKey(req, res);
    const { datasetId, format } = req.body;

    if (!datasetId) {
      ApiResponse.error(res, 400, 'MISSING_DATASET_ID', 'datasetId is required.');
      return;
    }

    const exportFormat = (format || 'csv').toLowerCase() as ExportFormat;
    if (!['csv', 'json', 'xlsx'].includes(exportFormat)) {
      ApiResponse.error(res, 400, 'INVALID_FORMAT', 'Supported formats are csv, json, xlsx.');
      return;
    }

    const exported = unifiedDataLayer.exportDataset(storeKey, datasetId, exportFormat);

    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);

    if (Buffer.isBuffer(exported.content)) {
      res.send(exported.content);
    } else {
      res.send(exported.content);
    }
  } catch (err: any) {
    Logger.error('Dataset export failed', err);
    ApiResponse.error(res, 500, 'EXPORT_FAILED', err.message);
  }
});
