import { UnifiedDataLayer } from '../import/UnifiedDataLayer';
import { DataProfiler } from '../import/DataProfiler';
import { ChunkProcessingEngine } from './ChunkProcessingEngine';
import { PerformanceJobManager } from './PerformanceJobManager';
import { TransformStep, CleaningPreviewResult, CleanedDatasetSaveResult } from '../../src/types/cleaning';
import { ImportedDataset, ExportFormat } from '../../src/types/import';
import { ImportSecurity } from '../import/ImportSecurity';
import * as XLSX from 'xlsx';
import { Logger } from '../utils/logger';

export class DataCleaningService {
  /**
   * Generates a before-and-after cleaning preview with comparative data quality scores
   * Optimized for large datasets using ChunkProcessingEngine and bounded diff arrays.
   */
  public static async previewPipeline(
    sessionId: string,
    datasetId: string,
    steps: TransformStep[],
    options: {
      jobId?: string;
      cancellationToken?: { isCancelled: () => boolean };
      maxRows?: number;
    } = {}
  ): Promise<CleaningPreviewResult> {
    const startTime = Date.now();
    const udl = UnifiedDataLayer.getInstance();
    const dataset = udl.getDataset(sessionId, datasetId);
    if (!dataset) {
      throw new Error(`Dataset '${datasetId}' not found.`);
    }

    const jobManager = PerformanceJobManager.getInstance();

    // Fetch all rows from SQLite
    const maxRows = options.maxRows || 1000000;
    const queryRes = await udl.executeQuery(sessionId, `SELECT * FROM "${dataset.tableName}"`, { maxRows });
    const allRows = queryRes.rows;

    // Run ChunkProcessingEngine
    const chunkRes = ChunkProcessingEngine.applyPipelineChunked(allRows, dataset.columns, steps, {
      cancellationToken: {
        isCancelled: () => {
          if (options.cancellationToken?.isCancelled()) return true;
          if (options.jobId && jobManager.isCancelled(options.jobId)) return true;
          return false;
        }
      },
      onProgress: (p) => {
        if (options.jobId) {
          jobManager.updateProgress(options.jobId, p.rowsProcessed, {
            totalRows: p.totalRows,
            stepNumber: p.stepNumber,
            totalSteps: p.totalSteps,
            currentStepName: p.currentStepName
          });
        }
      }
    });

    if (chunkRes.cancelled) {
      if (options.jobId) jobManager.markJobCancelled(options.jobId);
      throw new Error('Pipeline preview was cancelled by user.');
    }

    // Profile before and after (using sample if large dataset)
    const qualityBefore = dataset.profile || DataProfiler.profile(
      dataset.datasetId,
      dataset.name,
      dataset.columns,
      allRows
    );

    const qualityAfter = DataProfiler.profile(
      `${dataset.datasetId}_cleaned_preview`,
      `${dataset.name} (Cleaned)`,
      chunkRes.columns,
      chunkRes.cleanedRows
    );

    if (chunkRes.summary) {
      chunkRes.summary.dataQualityBefore = qualityBefore.overallQualityScore || 0;
      chunkRes.summary.dataQualityAfter = qualityAfter.overallQualityScore || 0;
    }

    const duration = Date.now() - startTime;
    jobManager.recordMetric({
      operation: 'PREVIEW_PIPELINE',
      datasetId,
      rowCount: allRows.length,
      durationMs: duration,
      rowsPerSecond: duration > 0 ? Math.round((allRows.length / (duration / 1000))) : allRows.length,
      strategyUsed: 'Chunked Execution Pipeline'
    });

    return {
      originalRows: allRows.slice(0, 50),
      cleanedRows: chunkRes.cleanedRows.slice(0, 50),
      columns: chunkRes.columns,
      totalOriginalRows: chunkRes.totalOriginalRows,
      totalCleanedRows: chunkRes.totalCleanedRows,
      affectedRowCount: chunkRes.affectedRowCount,
      affectedColumnCount: chunkRes.affectedColumnCount,
      changedCells: chunkRes.changedCells,
      stepMetrics: chunkRes.stepMetrics,
      summary: chunkRes.summary,
      qualityBefore,
      qualityAfter,
      executionTimeMs: duration
    };
  }

  /**
   * Saves cleaned rows as a new versioned dataset in the Unified Data Layer
   * Never mutates or overwrites the original dataset
   */
  public static async saveCleanedDataset(
    sessionId: string,
    sourceDatasetId: string,
    newDatasetName: string,
    steps: TransformStep[],
    pipelineMetadata?: { pipelineId?: string; pipelineName?: string; pipelineVersion?: number; jobId?: string }
  ): Promise<CleanedDatasetSaveResult> {
    const startTime = Date.now();
    const udl = UnifiedDataLayer.getInstance();
    const source = udl.getDataset(sessionId, sourceDatasetId);
    if (!source) {
      throw new Error(`Source dataset '${sourceDatasetId}' not found.`);
    }

    const jobManager = PerformanceJobManager.getInstance();
    const name = newDatasetName?.trim() || `${source.name}_cleaned`;

    // Fetch all source rows
    const queryRes = await udl.executeQuery(sessionId, `SELECT * FROM "${source.tableName}"`, { maxRows: 1000000 });
    const allRows = queryRes.rows;

    // Apply chunked pipeline
    const chunkRes = ChunkProcessingEngine.applyPipelineChunked(allRows, source.columns, steps, {
      cancellationToken: {
        isCancelled: () => {
          if (pipelineMetadata?.jobId && jobManager.isCancelled(pipelineMetadata.jobId)) return true;
          return false;
        }
      },
      onProgress: (p) => {
        if (pipelineMetadata?.jobId) {
          jobManager.updateProgress(pipelineMetadata.jobId, p.rowsProcessed, {
            totalRows: p.totalRows,
            stepNumber: p.stepNumber,
            totalSteps: p.totalSteps,
            currentStepName: p.currentStepName
          });
        }
      }
    });

    if (chunkRes.cancelled) {
      if (pipelineMetadata?.jobId) jobManager.markJobCancelled(pipelineMetadata.jobId);
      throw new Error('Dataset saving was cancelled by user.');
    }

    // Register new dataset in Unified Data Layer
    const newDataset = await udl.registerDataset(sessionId, {
      sourceName: name,
      fileType: source.fileType,
      columns: chunkRes.columns,
      rows: chunkRes.cleanedRows,
      fileSize: source.fileSize,
      workspaceId: source.workspaceId,
      jobId: pipelineMetadata?.jobId
    });

    const activeStepsCount = steps.filter(s => s.enabled).length;
    const duration = Date.now() - startTime;

    jobManager.recordMetric({
      operation: 'SAVE_CLEANED_DATASET',
      datasetId: newDataset.datasetId,
      rowCount: newDataset.rowCount,
      durationMs: duration,
      rowsPerSecond: duration > 0 ? Math.round((newDataset.rowCount / (duration / 1000))) : newDataset.rowCount,
      strategyUsed: 'Chunked Transformation + SQLite Batch Registration'
    });

    Logger.info('Cleaned dataset created and registered in UnifiedDataLayer', {
      sessionId,
      sourceDatasetId,
      newDatasetId: newDataset.datasetId,
      newTableName: newDataset.tableName,
      stepsApplied: activeStepsCount,
      rowCount: newDataset.rowCount,
      durationMs: duration
    });

    return {
      originalDatasetId: sourceDatasetId,
      newDataset,
      stepsApplied: activeStepsCount,
      message: `Successfully created cleaned dataset '${name}' with ${newDataset.rowCount.toLocaleString()} rows.`,
      lineage: {
        sourceDatasetId,
        sourceDatasetName: source.name,
        pipelineId: pipelineMetadata?.pipelineId,
        pipelineName: pipelineMetadata?.pipelineName,
        pipelineVersion: pipelineMetadata?.pipelineVersion,
        stepsCount: activeStepsCount,
        createdAt: new Date().toISOString()
      }
    };
  }

  /**
   * Exports cleaned data directly with formula injection protection
   */
  public static async exportCleanedData(
    sessionId: string,
    sourceDatasetId: string,
    steps: TransformStep[],
    format: ExportFormat,
    customName?: string,
    options: { jobId?: string } = {}
  ): Promise<{ mimeType: string; fileName: string; content: string | Buffer }> {
    const startTime = Date.now();
    const udl = UnifiedDataLayer.getInstance();
    const source = udl.getDataset(sessionId, sourceDatasetId);
    if (!source) {
      throw new Error(`Source dataset '${sourceDatasetId}' not found.`);
    }

    const jobManager = PerformanceJobManager.getInstance();
    const queryRes = await udl.executeQuery(sessionId, `SELECT * FROM "${source.tableName}"`, { maxRows: 1000000 });
    
    const chunkRes = ChunkProcessingEngine.applyPipelineChunked(queryRes.rows, source.columns, steps, {
      cancellationToken: {
        isCancelled: () => {
          if (options.jobId && jobManager.isCancelled(options.jobId)) return true;
          return false;
        }
      }
    });

    if (chunkRes.cancelled) {
      throw new Error('Export was cancelled by user.');
    }

    const rows = chunkRes.cleanedRows;
    const columns = chunkRes.columns;
    const baseName = (customName || `${source.name}_cleaned`).replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'json') {
      const content = JSON.stringify(rows, null, 2);
      return {
        mimeType: 'application/json; charset=utf-8',
        fileName: `${baseName}.json`,
        content
      };
    }

    if (format === 'csv') {
      const colNames = columns.map(c => c.name);
      const headerLine = colNames.map(c => `"${c.replace(/"/g, '""')}"`).join(',');

      const rowLines = rows.map(row => {
        return colNames.map(c => {
          const val = row[c];
          if (val === null || val === undefined) return '';
          const safeVal = ImportSecurity.sanitizeFormulaInjection(val);
          return `"${String(safeVal).replace(/"/g, '""')}"`;
        }).join(',');
      });

      const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
      return {
        mimeType: 'text/csv; charset=utf-8',
        fileName: `${baseName}.csv`,
        content: csvContent
      };
    }

    if (format === 'xlsx') {
      const sanitizedRows = rows.map(row => {
        const cleanRow: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          cleanRow[k] = ImportSecurity.sanitizeFormulaInjection(v);
        }
        return cleanRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(sanitizedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, baseName.slice(0, 31));

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `${baseName}.xlsx`,
        content: buffer
      };
    }

    throw new Error(`Unsupported export format: ${format}`);
  }
}
