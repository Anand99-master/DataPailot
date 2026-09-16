import { UnifiedDataLayer } from '../import/UnifiedDataLayer';
import { DataProfiler } from '../import/DataProfiler';
import { ChunkProcessingEngine } from './ChunkProcessingEngine';
import { PerformanceJobManager } from './PerformanceJobManager';
import { TransformStep, CleaningPreviewResult, CleanedDatasetSaveResult } from '../../src/types/cleaning';
import { ImportedDataset, ExportFormat, ColumnMetadata, DataProfile } from '../../src/types/import';
import { ImportSecurity } from '../import/ImportSecurity';
import { ConnectionManager } from '../database/ConnectionManager';
import { DataQualityService } from './DataQualityService';
import * as XLSX from 'xlsx';
import { Logger } from '../utils/logger';

export interface CleaningSourceInfo {
  datasetId: string;
  name: string;
  tableName: string;
  schema: string;
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  totalRows: number;
  sourceType: 'FILE' | 'DATABASE';
  fileType: 'CSV' | 'XLSX' | 'JSON';
  workspaceId?: string;
  projectId?: string;
  profile?: DataProfile;
  sourceDatabaseType?: string;
  sourceConnectionId?: string;
  sourceSchema?: string;
  sourceTable?: string;
  isDatabaseTable?: boolean;
}

export class DataCleaningService {
  /**
   * Helper to map database SQL column types to standard ColumnMetadata dataTypes
   */
  private static mapSqlTypeToColumnType(sqlType: string): 'text' | 'integer' | 'numeric' | 'boolean' | 'date' | 'timestamp' | 'unknown' {
    const t = (sqlType || '').toLowerCase();
    if (t.includes('int') || t.includes('serial') || t.includes('bigint') || t.includes('smallint')) return 'integer';
    if (t.includes('num') || t.includes('dec') || t.includes('float') || t.includes('double') || t.includes('real') || t.includes('money')) return 'numeric';
    if (t.includes('bool')) return 'boolean';
    if (t.includes('timestamp') || t.includes('timestamptz') || t.includes('datetime')) return 'timestamp';
    if (t.includes('date') || t.includes('time')) return 'date';
    if (t.includes('char') || t.includes('text') || t.includes('varchar') || t.includes('string') || t.includes('clob')) return 'text';
    return 'unknown';
  }

  /**
   * Universally resolves the source dataset or database table for cleaning.
   * Supports:
   * 1. Imported datasets registered in UnifiedDataLayer (by datasetId, tableName, or display name)
   * 2. Connected database tables (via format db:schema:table, schema.table, or table name)
   * Never mutates source database or tables.
   */
  public static async getSourceInfo(
    sessionIdOrStoreKey: string,
    datasetId: string,
    options: { maxRows?: number } = {}
  ): Promise<CleaningSourceInfo> {
    if (!datasetId || !datasetId.trim()) {
      throw new Error('datasetId is required.');
    }

    const cleanId = datasetId.trim();
    const maxRows = options.maxRows || 100000;
    const parts = sessionIdOrStoreKey.split(':');
    const baseSessionId = parts[0];
    const workspaceId = parts.length > 1 ? parts[1] : undefined;
    const projectId = parts.length > 2 ? parts[2] : undefined;

    // 1. Try finding in UnifiedDataLayer if NOT explicitly prefixed with db:
    const udl = UnifiedDataLayer.getInstance();
    if (!cleanId.startsWith('db:')) {
      const importedDs = udl.findDataset(sessionIdOrStoreKey, cleanId);
      if (importedDs) {
        const queryRes = await udl.executeQuery(sessionIdOrStoreKey, `SELECT * FROM "${importedDs.tableName}"`, { maxRows });
        return {
          datasetId: importedDs.datasetId,
          name: importedDs.name,
          tableName: importedDs.tableName,
          schema: importedDs.schema || 'imported',
          columns: importedDs.columns,
          rows: queryRes.rows,
          totalRows: importedDs.rowCount,
          sourceType: importedDs.sourceType || 'FILE',
          fileType: importedDs.fileType || 'CSV',
          workspaceId: importedDs.workspaceId || workspaceId,
          projectId: importedDs.projectId || projectId,
          profile: importedDs.profile,
          sourceDatabaseType: importedDs.sourceDatabaseType,
          sourceConnectionId: importedDs.sourceConnectionId,
          sourceSchema: importedDs.sourceSchema,
          sourceTable: importedDs.sourceTable,
          isDatabaseTable: false
        };
      }
    }

    // 2. Resolve database table from active DatabaseAdapter
    let schema = 'public';
    let tableName = cleanId;

    if (cleanId.startsWith('db:')) {
      const stripped = cleanId.replace(/^db:/, '');
      if (stripped.includes(':')) {
        const sParts = stripped.split(':');
        schema = sParts[0];
        tableName = sParts[1];
      } else if (stripped.includes('.')) {
        const sParts = stripped.split('.');
        schema = sParts[0];
        tableName = sParts[1];
      } else {
        tableName = stripped;
      }
    } else if (cleanId.includes('.')) {
      const sParts = cleanId.split('.');
      schema = sParts[0];
      tableName = sParts[1];
    } else if (cleanId.includes(':')) {
      const sParts = cleanId.split(':');
      schema = sParts[0];
      tableName = sParts[1];
    }

    const adapter = ConnectionManager.getInstance().getAdapter(baseSessionId);
    if (!adapter) {
      throw new Error(`Data source '${datasetId}' was not found in imported datasets and no active database connection was found.`);
    }

    const dialect = adapter.getDialect();
    const connInfo = ConnectionManager.getInstance().getConnectionInfo(baseSessionId);

    // Fetch table details safely through adapter
    let tableDetails = await adapter.getTableDetails(schema, tableName).catch(() => null);
    if (!tableDetails && schema !== 'public') {
      // Try with public schema
      tableDetails = await adapter.getTableDetails('public', tableName).catch(() => null);
      if (tableDetails) schema = 'public';
    }

    // Safely execute read-only query on source database table
    const qualifiedTable = dialect.qualifyTable(schema, tableName);
    const selectSql = dialect.formatLimit(`SELECT * FROM ${qualifiedTable}`, maxRows);
    const queryRes = await adapter.executeReadOnlyQuery(selectSql);

    // Map column metadata
    let columns: ColumnMetadata[];
    if (tableDetails && tableDetails.columns && tableDetails.columns.length > 0) {
      columns = tableDetails.columns.map(c => ({
        name: c.name,
        dataType: DataCleaningService.mapSqlTypeToColumnType(c.dataType),
        originalType: c.dataType,
        isNullable: c.isNullable,
        nullCount: 0,
        sampleValues: []
      }));
    } else {
      columns = queryRes.columns.map(c => ({
        name: c.name,
        dataType: DataCleaningService.mapSqlTypeToColumnType(c.dataType),
        originalType: c.dataType,
        isNullable: true,
        nullCount: 0,
        sampleValues: []
      }));
    }

    // Get total row count non-destructively
    let totalRows = tableDetails?.approximateRowCount || queryRes.rowCount;
    try {
      const countSql = `SELECT COUNT(*) as cnt FROM ${qualifiedTable}`;
      const cntRes = await adapter.executeReadOnlyQuery(countSql);
      totalRows = Number(cntRes.rows[0]?.cnt) || queryRes.rowCount;
    } catch {}

    // Build or fetch quality profile
    let profile: DataProfile | undefined;
    try {
      profile = await DataQualityService.profile(sessionIdOrStoreKey, schema, tableName, false);
    } catch {
      profile = DataProfiler.profile(
        `db:${schema}:${tableName}`,
        tableName,
        columns,
        queryRes.rows
      );
    }

    return {
      datasetId: `db:${schema}:${tableName}`,
      name: tableName,
      tableName: tableName,
      schema,
      columns,
      rows: queryRes.rows,
      totalRows,
      sourceType: 'DATABASE',
      fileType: 'CSV',
      workspaceId,
      projectId,
      profile,
      sourceDatabaseType: connInfo?.type || 'postgresql',
      sourceConnectionId: connInfo?.id,
      sourceSchema: schema,
      sourceTable: tableName,
      isDatabaseTable: true
    };
  }

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
    const source = await this.getSourceInfo(sessionId, datasetId, options);
    const jobManager = PerformanceJobManager.getInstance();
    const allRows = source.rows;

    // Run ChunkProcessingEngine
    const chunkRes = ChunkProcessingEngine.applyPipelineChunked(allRows, source.columns, steps, {
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
    const qualityBefore = source.profile || DataProfiler.profile(
      source.datasetId,
      source.name,
      source.columns,
      allRows
    );

    const qualityAfter = DataProfiler.profile(
      `${source.datasetId}_cleaned_preview`,
      `${source.name} (Cleaned)`,
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
   * Never mutates or overwrites the original dataset or connected database table.
   */
  public static async saveCleanedDataset(
    sessionId: string,
    sourceDatasetId: string,
    newDatasetName: string,
    steps: TransformStep[],
    pipelineMetadata?: { pipelineId?: string; pipelineName?: string; pipelineVersion?: number; jobId?: string }
  ): Promise<CleanedDatasetSaveResult> {
    const startTime = Date.now();
    const source = await this.getSourceInfo(sessionId, sourceDatasetId, { maxRows: 1000000 });
    const udl = UnifiedDataLayer.getInstance();
    const jobManager = PerformanceJobManager.getInstance();
    const name = newDatasetName?.trim() || `${source.name}_cleaned`;
    const allRows = source.rows;

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

    // Register new derived dataset in Unified Data Layer with full source lineage
    const newDataset = await udl.registerDataset(sessionId, {
      sourceName: name,
      fileType: source.fileType,
      columns: chunkRes.columns,
      rows: chunkRes.cleanedRows,
      fileSize: 0,
      workspaceId: source.workspaceId,
      projectId: source.projectId,
      sourceType: source.sourceType === 'DATABASE' ? 'DATABASE' : 'FILE',
      sourceSchema: source.sourceSchema || source.schema,
      sourceTable: source.sourceTable || source.tableName,
      sourceDatabaseType: source.sourceDatabaseType,
      sourceConnectionId: source.sourceConnectionId,
      isDerived: true,
      parentDatasetId: source.datasetId,
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
      sourceType: source.sourceType,
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
        sourceType: source.sourceType,
        sourceSchema: source.sourceSchema,
        sourceTable: source.sourceTable,
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
    const source = await this.getSourceInfo(sessionId, sourceDatasetId, { maxRows: 1000000 });
    const jobManager = PerformanceJobManager.getInstance();

    const chunkRes = ChunkProcessingEngine.applyPipelineChunked(source.rows, source.columns, steps, {
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
