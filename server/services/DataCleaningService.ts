import { UnifiedDataLayer } from '../import/UnifiedDataLayer';
import { DataProfiler } from '../import/DataProfiler';
import { DataCleaningEngine } from '../../src/utils/dataCleaningEngine';
import { TransformStep, CleaningPreviewResult, CleanedDatasetSaveResult } from '../../src/types/cleaning';
import { ImportedDataset, ExportFormat } from '../../src/types/import';
import { ImportSecurity } from '../import/ImportSecurity';
import * as XLSX from 'xlsx';
import { Logger } from '../utils/logger';

export class DataCleaningService {
  /**
   * Generates a before-and-after cleaning preview with comparative data quality scores
   */
  public static async previewPipeline(
    sessionId: string,
    datasetId: string,
    steps: TransformStep[]
  ): Promise<CleaningPreviewResult> {
    const udl = UnifiedDataLayer.getInstance();
    const dataset = udl.getDataset(sessionId, datasetId);
    if (!dataset) {
      throw new Error(`Dataset '${datasetId}' not found.`);
    }

    // Fetch all rows from SQLite
    const queryRes = await udl.executeQuery(sessionId, `SELECT * FROM "${dataset.tableName}"`, { maxRows: 100000 });
    const allRows = queryRes.rows;

    // Run transformation engine
    const previewResult = DataCleaningEngine.applyPipeline(allRows, dataset.columns, steps);

    // Profile before and after
    previewResult.qualityBefore = dataset.profile || DataProfiler.profile(
      dataset.datasetId,
      dataset.name,
      dataset.columns,
      allRows
    );

    previewResult.qualityAfter = DataProfiler.profile(
      `${dataset.datasetId}_cleaned_preview`,
      `${dataset.name} (Cleaned)`,
      previewResult.columns,
      previewResult.cleanedRows
    );

    if (previewResult.summary) {
      previewResult.summary.dataQualityBefore = previewResult.qualityBefore.overallQualityScore;
      previewResult.summary.dataQualityAfter = previewResult.qualityAfter.overallQualityScore;
    }

    return previewResult;
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
    pipelineMetadata?: { pipelineId?: string; pipelineName?: string; pipelineVersion?: number }
  ): Promise<CleanedDatasetSaveResult> {
    const udl = UnifiedDataLayer.getInstance();
    const source = udl.getDataset(sessionId, sourceDatasetId);
    if (!source) {
      throw new Error(`Source dataset '${sourceDatasetId}' not found.`);
    }

    const name = newDatasetName?.trim() || `${source.name}_cleaned`;

    // Fetch all source rows
    const queryRes = await udl.executeQuery(sessionId, `SELECT * FROM "${source.tableName}"`, { maxRows: 500000 });
    const allRows = queryRes.rows;

    // Apply pipeline
    const previewResult = DataCleaningEngine.applyPipeline(allRows, source.columns, steps);

    // Register new dataset in Unified Data Layer
    const newDataset = await udl.registerDataset(sessionId, {
      sourceName: name,
      fileType: source.fileType,
      columns: previewResult.columns,
      rows: previewResult.cleanedRows,
      fileSize: source.fileSize
    });

    const activeStepsCount = steps.filter(s => s.enabled).length;

    Logger.info('Cleaned dataset created and registered in UnifiedDataLayer', {
      sessionId,
      sourceDatasetId,
      newDatasetId: newDataset.datasetId,
      newTableName: newDataset.tableName,
      stepsApplied: activeStepsCount,
      rowCount: newDataset.rowCount
    });

    return {
      originalDatasetId: sourceDatasetId,
      newDataset,
      stepsApplied: activeStepsCount,
      message: `Successfully created cleaned dataset '${name}' with ${newDataset.rowCount} rows.`,
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
    customName?: string
  ): Promise<{ mimeType: string; fileName: string; content: string | Buffer }> {
    const udl = UnifiedDataLayer.getInstance();
    const source = udl.getDataset(sessionId, sourceDatasetId);
    if (!source) {
      throw new Error(`Source dataset '${sourceDatasetId}' not found.`);
    }

    const queryRes = await udl.executeQuery(sessionId, `SELECT * FROM "${source.tableName}"`, { maxRows: 500000 });
    const previewResult = DataCleaningEngine.applyPipeline(queryRes.rows, source.columns, steps);
    const rows = previewResult.cleanedRows;
    const columns = previewResult.columns;

    const baseName = (customName || `${source.name}_cleaned`).replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'json') {
      return {
        mimeType: 'application/json; charset=utf-8',
        fileName: `${baseName}.json`,
        content: JSON.stringify(rows, null, 2)
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
