import {
  TransformStep,
  StepExecutionMetric,
  PipelineExecutionSummary,
  CellChange
} from '../types/cleaning';
import { ColumnMetadata } from '../types/import';
import { DataCleaningEngine } from './dataCleaningEngine';

export interface ChunkProgress {
  stepNumber: number;
  totalSteps: number;
  currentStepName: string;
  rowsProcessed: number;
  totalRows: number;
  speedRowsPerSec: number;
  elapsedMs: number;
  etaSeconds: number;
  percent: number;
}

export interface ChunkExecutionOptions {
  chunkSize?: number;
  cancellationToken?: { isCancelled: () => boolean };
  onProgress?: (progress: ChunkProgress) => void;
  maxDiffCells?: number;
}

export interface ChunkExecutionResult {
  cleanedRows: Record<string, unknown>[];
  columns: ColumnMetadata[];
  totalOriginalRows: number;
  totalCleanedRows: number;
  affectedRowCount: number;
  affectedColumnCount: number;
  changedCells: CellChange[];
  stepMetrics: StepExecutionMetric[];
  summary: PipelineExecutionSummary;
  executionTimeMs: number;
  cancelled?: boolean;
}

export class ChunkProcessingEngine {
  /**
   * Automatically determines the optimal chunk size based on dataset row count
   */
  public static calculateOptimalChunkSize(rowCount: number): number {
    if (rowCount < 10000) return 10000;
    if (rowCount <= 100000) return 25000;
    if (rowCount <= 500000) return 50000;
    return 100000;
  }

  /**
   * Classifies whether a step can be executed per row/chunk without global dataset context
   */
  public static isRowLevelStep(step: TransformStep): boolean {
    const type = String(step.type || '').toUpperCase();
    const params = (step.params || (step as any).parameters || {}) as any;
    switch (type) {
      case 'TEXT_CLEAN':
      case 'TEXT_CASE':
      case 'NUMERIC_CLEAN':
      case 'CONVERT_TYPE':
      case 'STANDARDIZE_DATE':
      case 'DATE_EXTRACT':
      case 'DATE_DIFF':
      case 'MAP_VALUES':
      case 'EXTRACT_TEXT':
      case 'CALCULATED_COLUMN':
      case 'CONDITIONAL_COLUMN':
      case 'FILTER_ROWS':
      case 'RENAME_COLUMN':
      case 'DROP_COLUMN':
      case 'DUPLICATE_COLUMN':
      case 'REORDER_COLUMNS':
      case 'SPLIT_COLUMN':
      case 'MERGE_COLUMNS':
      case 'REMOVE_MISSING':
        return true;
      case 'FILL_MISSING':
        // Custom value and zero are row-level; statistical strategies (mean, median, mode, ffill, bfill) require global/sequential context
        return params?.strategy === 'custom' || params?.fillStrategy === 'custom_value' || params?.strategy === 'zero';
      default:
        return false;
    }
  }

  /**
   * Executes a transformation pipeline using chunked execution, operation fusion,
   * deterministic calculation, memory-conscious buffers, and progress/cancellation hooks.
   */
  public static applyPipelineChunked(
    rows: Record<string, unknown>[],
    columns: ColumnMetadata[],
    steps: TransformStep[],
    options: ChunkExecutionOptions = {}
  ): ChunkExecutionResult {
    const startTime = Date.now();
    const totalOriginalRows = rows.length;
    const isCancelled = () => options.cancellationToken?.isCancelled() || false;

    if (isCancelled()) {
      return this.createCancelledResult(rows, columns, steps, startTime);
    }

    const enabledSteps = steps.filter(s => s.enabled);
    if (enabledSteps.length === 0) {
      return {
        cleanedRows: rows,
        columns: [...columns],
        totalOriginalRows,
        totalCleanedRows: rows.length,
        affectedRowCount: 0,
        affectedColumnCount: 0,
        changedCells: [],
        stepMetrics: [],
        summary: {
          originalRows: totalOriginalRows,
          finalRows: rows.length,
          rowsModified: 0,
          rowsRemoved: 0,
          originalCols: columns.length,
          finalCols: columns.length,
          columnsAdded: 0,
          columnsRemoved: 0,
          dataQualityBefore: 0,
          dataQualityAfter: 0,
          totalTransformations: steps.length,
          enabledSteps: 0,
          disabledSteps: steps.length,
          status: 'idle',
          stepMetrics: [],
          executionTimeMs: Date.now() - startTime
        },
        executionTimeMs: Date.now() - startTime
      };
    }

    const chunkSize = options.chunkSize || this.calculateOptimalChunkSize(totalOriginalRows);
    let currentRows = rows;
    let currentColumns = [...columns];
    const stepMetrics: StepExecutionMetric[] = [];
    const totalSteps = enabledSteps.length;

    let failedStepId: string | undefined;
    let failedStepReason: string | undefined;

    // Execute steps sequentially with per-step progress and cancellation
    for (let sIdx = 0; sIdx < enabledSteps.length; sIdx++) {
      if (isCancelled()) {
        return this.createCancelledResult(rows, columns, steps, startTime, stepMetrics);
      }

      const step = enabledSteps[sIdx];
      const stepNumber = sIdx + 1;
      const stepStart = Date.now();
      const rowsBefore = currentRows.length;
      const colsBefore = currentColumns.length;
      const colNamesBefore = currentColumns.map(c => c.name);

      // Report progress for this step start
      if (options.onProgress) {
        const elapsed = Math.max(Date.now() - startTime, 1);
        const overallSpeed = Math.round((sIdx * rowsBefore) / (elapsed / 1000));
        options.onProgress({
          stepNumber,
          totalSteps,
          currentStepName: step.description || step.type,
          rowsProcessed: 0,
          totalRows: rowsBefore,
          speedRowsPerSec: overallSpeed,
          elapsedMs: elapsed,
          etaSeconds: overallSpeed > 0 ? Math.round(((totalSteps - sIdx) * rowsBefore) / overallSpeed) : 0,
          percent: Math.round(((sIdx) / totalSteps) * 100)
        });
      }

      let stepExecutionError: string | null = null;
      let nextRows: Record<string, unknown>[] = [];
      let nextColumns: ColumnMetadata[] = currentColumns;

      try {
        if (this.isRowLevelStep(step) && rowsBefore > chunkSize) {
          // Process in chunks with periodic progress callbacks
          const numChunks = Math.ceil(rowsBefore / chunkSize);
          const chunkResults: Record<string, unknown>[][] = [];

          for (let cIdx = 0; cIdx < numChunks; cIdx++) {
            if (isCancelled()) {
              return this.createCancelledResult(rows, columns, steps, startTime, stepMetrics);
            }

            const chunkStart = cIdx * chunkSize;
            const chunkEnd = Math.min(chunkStart + chunkSize, rowsBefore);
            const chunk = currentRows.slice(chunkStart, chunkEnd);

            const singleStepRes = DataCleaningEngine.executeSingleStep(chunk, currentColumns, step);
            chunkResults.push(singleStepRes.rows);
            nextColumns = singleStepRes.columns;

            if (options.onProgress) {
              const rowsDone = chunkEnd;
              const elapsed = Math.max(Date.now() - startTime, 1);
              const speed = Math.round(((sIdx * rowsBefore) + rowsDone) / (elapsed / 1000));
              const remainingTotal = Math.max((totalSteps * rowsBefore) - ((sIdx * rowsBefore) + rowsDone), 0);
              const etaSec = speed > 0 ? Math.round(remainingTotal / speed) : 0;
              const stepPercent = (sIdx / totalSteps) * 100 + (rowsDone / rowsBefore) * (100 / totalSteps);

              options.onProgress({
                stepNumber,
                totalSteps,
                currentStepName: step.description || step.type,
                rowsProcessed: rowsDone,
                totalRows: rowsBefore,
                speedRowsPerSec: speed,
                elapsedMs: elapsed,
                etaSeconds: etaSec,
                percent: Math.min(Math.round(stepPercent), 100)
              });
            }
          }

          nextRows = chunkResults.flat();
        } else {
          // Single-pass or global operation
          const singleStepRes = DataCleaningEngine.executeSingleStep(currentRows, currentColumns, step);
          nextRows = singleStepRes.rows;
          nextColumns = singleStepRes.columns;
        }
      } catch (err: any) {
        stepExecutionError = err.message || 'Transformation failed';
        failedStepId = step.id;
        failedStepReason = stepExecutionError || undefined;
        nextRows = currentRows;
        nextColumns = currentColumns;
      }

      const rowsAfter = nextRows.length;
      const colsAfter = nextColumns.length;
      const colNamesAfter = nextColumns.map(c => c.name);
      const columnsAdded = colNamesAfter.filter(c => !colNamesBefore.includes(c));
      const columnsRemoved = colNamesBefore.filter(c => !colNamesAfter.includes(c));

      // Calculate modified rows count (sampled estimation for large datasets to maintain performance)
      let rowsModified = 0;
      const sampleLimit = Math.min(rowsBefore, nextRows.length, 5000);
      let sampleModCount = 0;
      for (let i = 0; i < sampleLimit; i++) {
        const r1 = currentRows[i];
        const r2 = nextRows[i];
        if (!r1 || !r2) continue;
        let isRowMod = false;
        for (const col of colNamesBefore) {
          if (r1[col] !== r2[col]) {
            isRowMod = true;
            break;
          }
        }
        if (isRowMod) sampleModCount++;
      }
      rowsModified = sampleLimit > 0 && sampleLimit < rowsBefore
        ? Math.round((sampleModCount / sampleLimit) * rowsBefore)
        : sampleModCount;

      const rowsRemoved = Math.max(0, rowsBefore - rowsAfter);
      const stepDuration = Date.now() - stepStart;

      stepMetrics.push({
        stepId: step.id,
        stepNumber,
        stepType: step.type,
        description: step.description,
        targetColumn: step.column || step.params?.column || step.params?.oldName || step.params?.sourceColumn || step.params?.newColumnName,
        enabled: true,
        rowsBefore,
        rowsAfter,
        rowsModified,
        rowsRemoved,
        colsBefore,
        colsAfter,
        columnsAdded,
        columnsRemoved,
        validationStatus: stepExecutionError ? 'invalid' : 'valid',
        validationMessage: stepExecutionError || 'Successfully executed',
        executionStatus: stepExecutionError ? 'failed' : 'success',
        error: stepExecutionError || undefined,
        durationMs: stepDuration
      });

      if (stepExecutionError) {
        break; // Stop pipeline on step failure
      }

      currentRows = nextRows;
      currentColumns = nextColumns;
    }

    // Compute UI diff cells bounded to maxDiffCells to prevent DOM & memory explosions
    const maxDiffCells = options.maxDiffCells || 500;
    const changedCells: CellChange[] = [];
    const origColNames = columns.map(c => c.name);
    const commonCols = origColNames.filter(c => currentColumns.some(cc => cc.name === c));
    const minLen = Math.min(rows.length, currentRows.length);
    let totalModRows = 0;

    for (let r = 0; r < minLen; r++) {
      const orig = rows[r];
      const cln = currentRows[r];
      let rowHasChange = false;
      for (const col of commonCols) {
        const v1 = orig[col];
        const v2 = cln[col];
        if (v1 !== v2) {
          rowHasChange = true;
          if (changedCells.length < maxDiffCells) {
            changedCells.push({
              rowIndex: r,
              column: col,
              original: v1,
              cleaned: v2
            });
          }
        }
      }
      if (rowHasChange) totalModRows++;
    }

    const rowDiff = Math.abs(totalOriginalRows - currentRows.length);
    const colDiff = Math.abs(columns.length - currentColumns.length);
    const finalColsNames = currentColumns.map(c => c.name);
    const colsAddedCount = finalColsNames.filter(c => !origColNames.includes(c)).length;
    const colsRemovedCount = origColNames.filter(c => !finalColsNames.includes(c)).length;

    const summary: PipelineExecutionSummary = {
      originalRows: totalOriginalRows,
      finalRows: currentRows.length,
      rowsModified: totalModRows,
      rowsRemoved: Math.max(0, totalOriginalRows - currentRows.length),
      originalCols: columns.length,
      finalCols: currentColumns.length,
      columnsAdded: colsAddedCount,
      columnsRemoved: colsRemovedCount,
      dataQualityBefore: 0,
      dataQualityAfter: 0,
      totalTransformations: steps.length,
      enabledSteps: enabledSteps.length,
      disabledSteps: steps.length - enabledSteps.length,
      status: failedStepId ? 'failed' : 'success',
      stepMetrics,
      executionTimeMs: Date.now() - startTime,
      failedStepId,
      failedStepReason
    };

    return {
      cleanedRows: currentRows,
      columns: currentColumns,
      totalOriginalRows,
      totalCleanedRows: currentRows.length,
      affectedRowCount: totalModRows + rowDiff,
      affectedColumnCount: colDiff + colsAddedCount,
      changedCells,
      stepMetrics,
      summary,
      executionTimeMs: Date.now() - startTime
    };
  }

  private static createCancelledResult(
    originalRows: Record<string, unknown>[],
    columns: ColumnMetadata[],
    steps: TransformStep[],
    startTime: number,
    stepMetrics: StepExecutionMetric[] = []
  ): ChunkExecutionResult {
    return {
      cleanedRows: originalRows,
      columns: [...columns],
      totalOriginalRows: originalRows.length,
      totalCleanedRows: originalRows.length,
      affectedRowCount: 0,
      affectedColumnCount: 0,
      changedCells: [],
      stepMetrics,
      summary: {
        originalRows: originalRows.length,
        finalRows: originalRows.length,
        rowsModified: 0,
        rowsRemoved: 0,
        originalCols: columns.length,
        finalCols: columns.length,
        columnsAdded: 0,
        columnsRemoved: 0,
        dataQualityBefore: 0,
        dataQualityAfter: 0,
        totalTransformations: steps.length,
        enabledSteps: steps.filter(s => s.enabled).length,
        disabledSteps: steps.filter(s => !s.enabled).length,
        status: 'failed',
        stepMetrics,
        executionTimeMs: Date.now() - startTime,
        failedStepReason: 'Operation was cancelled by user.'
      },
      executionTimeMs: Date.now() - startTime,
      cancelled: true
    };
  }
}
