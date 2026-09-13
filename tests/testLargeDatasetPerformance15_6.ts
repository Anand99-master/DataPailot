import { CsvParser } from '../server/import/CsvParser';
import { UnifiedDataLayer } from '../server/import/UnifiedDataLayer';
import { DataProfiler } from '../server/import/DataProfiler';
import { ChunkProcessingEngine } from '../server/services/ChunkProcessingEngine';
import { PerformanceJobManager } from '../server/services/PerformanceJobManager';
import { DataCleaningService } from '../server/services/DataCleaningService';
import { ImportSecurity } from '../server/import/ImportSecurity';
import { TransformStep } from '../src/types/cleaning';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runLargeDatasetPerformance15_6Tests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const sessionId = 'perf_test_session_' + Date.now();

  const runTest = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
    }
  };

  // Helper to generate deterministic synthetic dataset rows
  const generateSyntheticRows = (count: number) => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      rows.push({
        id: i + 1,
        name: `User_${i + 1}`,
        score: (i % 100) + 0.5,
        category: i % 2 === 0 ? 'Engineering' : 'Marketing',
        notes: i % 10 === 0 ? null : `Notes for record ${i + 1}`,
        formula_test: i % 5 === 0 ? '=SUM(A1:B1)' : 'standard_text'
      });
    }
    return rows;
  };

  const createMockColumns = (): import('../src/types/import').ColumnMetadata[] => [
    { name: 'id', dataType: 'integer', isNullable: false, nullCount: 0, sampleValues: [1, 2, 3] },
    { name: 'name', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['User_1', 'User_2'] },
    { name: 'score', dataType: 'numeric', isNullable: false, nullCount: 0, sampleValues: [10.5, 20.5] },
    { name: 'category', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['Engineering', 'Marketing'] },
    { name: 'notes', dataType: 'text', isNullable: true, nullCount: 100, sampleValues: ['Notes for record 1'] },
    { name: 'formula_test', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['standard_text'] }
  ];

  // Helper to generate synthetic CSV string
  const generateSyntheticCsv = (count: number) => {
    const header = 'id,name,score,category,notes,formula_test\n';
    const lines: string[] = [header];
    for (let i = 0; i < count; i++) {
      const notes = i % 10 === 0 ? '' : `Notes for record ${i + 1}`;
      const formula = i % 5 === 0 ? '=SUM(A1:B1)' : 'standard_text';
      lines.push(`${i + 1},User_${i + 1},${(i % 100) + 0.5},${i % 2 === 0 ? 'Engineering' : 'Marketing'},"${notes}","${formula}"\n`);
    }
    return lines.join('');
  };

  await runTest('15.6.1: Chunked CSV Parsing with Progress Callbacks (10,000 rows)', async () => {
    const csvData = generateSyntheticCsv(10000);
    let progressCalls = 0;
    let lastProcessed = 0;

    const parsed = CsvParser.parse(csvData, {
      chunkSize: 2000,
      onProgress: (p) => {
        progressCalls++;
        lastProcessed = p.rowsProcessed;
      }
    });

    if (parsed.rows.length !== 10000) {
      throw new Error(`Expected 10000 parsed rows, got ${parsed.rows.length}`);
    }
    if (parsed.columns.length !== 6) {
      throw new Error(`Expected 6 columns, got ${parsed.columns.length}`);
    }
    if (progressCalls < 4) {
      throw new Error(`Expected at least 4 progress reports, got ${progressCalls}`);
    }
    if (lastProcessed !== 10000) {
      throw new Error(`Expected lastProcessed 10000, got ${lastProcessed}`);
    }
  });

  await runTest('15.6.2: CSV Parsing Cancellation Token Support', async () => {
    const csvData = generateSyntheticCsv(10000);
    let isCancelled = false;

    const parsed = CsvParser.parse(csvData, {
      chunkSize: 1000,
      cancellationToken: {
        isCancelled: () => isCancelled
      },
      onProgress: (p) => {
        if (p.rowsProcessed >= 3000) {
          isCancelled = true;
        }
      }
    });

    if (parsed.rows.length >= 10000) {
      throw new Error('Parsing should have been cancelled before processing all rows');
    }
    if (parsed.rows.length < 3000) {
      throw new Error('Parsing should have processed at least 3000 rows before cancelling');
    }
  });

  await runTest('15.6.3: Unified Data Layer Chunked Ingestion & Windowed Pagination', async () => {
    const udl = UnifiedDataLayer.getInstance();
    const rows = generateSyntheticRows(12000);
    const columns = createMockColumns();

    const dataset = await udl.registerDataset(sessionId, {
      sourceName: 'large_test_ds',
      fileType: 'CSV',
      columns,
      rows
    });

    if (dataset.rowCount !== 12000) {
      throw new Error(`Expected 12000 rows stored, got ${dataset.rowCount}`);
    }

    // Windowed preview: Page 1 (offset 0, limit 50)
    const page1 = await udl.getDataPreview(sessionId, dataset.datasetId, { offset: 0, limit: 50 });
    if (page1.rows.length !== 50) {
      throw new Error(`Expected 50 rows on page 1, got ${page1.rows.length}`);
    }
    if (page1.totalRows !== 12000) {
      throw new Error(`Expected totalRows 12000, got ${page1.totalRows}`);
    }
    if (Number(page1.rows[0].id) !== 1) {
      throw new Error(`Expected row 0 ID to be 1, got ${page1.rows[0].id}`);
    }

    // Windowed preview: Page 100 (offset 5000, limit 25)
    const page100 = await udl.getDataPreview(sessionId, dataset.datasetId, { offset: 5000, limit: 25 });
    if (page100.rows.length !== 25) {
      throw new Error(`Expected 25 rows on offset 5000, got ${page100.rows.length}`);
    }
    if (Number(page100.rows[0].id) !== 5001) {
      throw new Error(`Expected row 0 ID to be 5001, got ${page100.rows[0].id}`);
    }
  });

  await runTest('15.6.4: Data Profiler Adaptive Sampling on Large Datasets', async () => {
    const rows = generateSyntheticRows(20000);
    const columns = createMockColumns();

    // Profile with sampling threshold of 5000
    const profile = DataProfiler.profile('ds_sampled', 'Large Sampled DS', columns, rows, {
      maxSampleRows: 5000,
      mode: 'Sampled'
    });

    if (profile.totalRows !== 20000) {
      throw new Error(`Expected totalRows 20000, got ${profile.totalRows}`);
    }
    if (!profile.isSampled) {
      throw new Error('Profile should be marked as sampled');
    }
    if (profile.analysisMode !== 'Sampled') {
      throw new Error('Profile analysisMode should be Sampled');
    }
    if (profile.rowsAnalyzed !== 5000) {
      throw new Error(`Expected 5000 rows analyzed, got ${profile.rowsAnalyzed}`);
    }
    if (!profile.samplePercentage || profile.samplePercentage !== 25) {
      throw new Error(`Expected 25% samplePercentage, got ${profile.samplePercentage}`);
    }
    const scoreCol = profile.columns['score'];
    if (!scoreCol?.isEstimated) {
      throw new Error('Sampled column profile should have isEstimated = true');
    }
    if (!scoreCol?.estimateNote?.includes('Sample-based estimation')) {
      throw new Error(`Expected estimateNote in column profile, got ${scoreCol?.estimateNote}`);
    }
  });

  await runTest('15.6.5: ChunkProcessingEngine Multi-Step Pipeline on 15,000 rows', async () => {
    const rows = generateSyntheticRows(15000);
    const columns = createMockColumns();

    const steps: TransformStep[] = [
      {
        id: 'step_1',
        type: 'TEXT_CLEAN',
        column: 'category',
        description: 'Uppercase Category',
        params: { textCase: 'uppercase', caseTransform: 'upper' },
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'step_2',
        type: 'FILL_MISSING',
        column: 'notes',
        description: 'Fill Missing Notes',
        params: { fillStrategy: 'custom_value', strategy: 'custom', customValue: 'No Notes' },
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'step_3',
        type: 'FILTER_ROWS',
        description: 'Keep Score >= 10',
        params: { column: 'score', operator: 'greater_than_or_equal', value: 10 },
        enabled: true,
        createdAt: new Date().toISOString()
      }
    ];

    let progressReports = 0;
    const result = ChunkProcessingEngine.applyPipelineChunked(rows, columns, steps, {
      chunkSize: 5000,
      onProgress: () => {
        progressReports++;
      }
    });

    if (result.cancelled) {
      throw new Error('Pipeline execution should not be cancelled');
    }
    if (result.totalOriginalRows !== 15000) {
      throw new Error(`Expected 15000 original rows, got ${result.totalOriginalRows}`);
    }
    if (result.totalCleanedRows >= 15000 || result.totalCleanedRows === 0) {
      throw new Error(`Expected filtered rows to be strictly less than 15000, got ${result.totalCleanedRows}`);
    }
    if (progressReports < 3) {
      throw new Error(`Expected at least 3 progress reports, got ${progressReports}`);
    }

    // Verify first row transformations
    const firstCleaned = result.cleanedRows[0];
    if (firstCleaned.category !== 'ENGINEERING' && firstCleaned.category !== 'MARKETING') {
      throw new Error(`Expected uppercase category, got ${firstCleaned.category}`);
    }
  });

  await runTest('15.6.6: PerformanceJobManager Progress & Cancellation State Tracking', async () => {
    const jobManager = PerformanceJobManager.getInstance();
    const job = jobManager.createJob('transform', 50000, 3, 'Filtering Rows');

    if (job.status !== 'processing') {
      throw new Error(`Expected job status 'processing', got ${job.status}`);
    }
    if (job.totalRows !== 50000) {
      throw new Error(`Expected totalRows 50000, got ${job.totalRows}`);
    }

    // Update progress
    const updated = jobManager.updateProgress(job.jobId, 25000, {
      stepNumber: 2,
      totalSteps: 3,
      currentStepName: 'Applying Text Transformations'
    });

    if (!updated || updated.percent !== 50) {
      throw new Error(`Expected 50% percent, got ${updated?.percent}`);
    }
    if (updated.rowsProcessed !== 25000) {
      throw new Error(`Expected 25000 rows processed, got ${updated?.rowsProcessed}`);
    }

    // Cancel job
    const cancelled = jobManager.cancelJob(job.jobId);
    if (!cancelled) {
      throw new Error('Failed to request job cancellation');
    }
    if (!jobManager.isCancelled(job.jobId)) {
      throw new Error('Job should report isCancelled = true');
    }
  });

  await runTest('15.6.7: Chunked Cleaned Dataset Export with Formula Injection Guard', async () => {
    const udl = UnifiedDataLayer.getInstance();
    const rows = generateSyntheticRows(5000);
    const columns = createMockColumns();

    const dataset = await udl.registerDataset(sessionId, {
      sourceName: 'export_security_test',
      fileType: 'CSV',
      columns,
      rows
    });

    const exportRes = await DataCleaningService.exportCleanedData(
      sessionId,
      dataset.datasetId,
      [],
      'csv',
      'cleaned_export_test'
    );

    const content = exportRes.content.toString();
    if (content.includes('"=SUM(A1:B1)"')) {
      throw new Error('Formula injection was not sanitized in chunked CSV export!');
    }
    if (!content.includes("'\t=SUM(A1:B1)") && !content.includes("'=SUM(A1:B1)")) {
      throw new Error('Formula should be sanitized with leading apostrophe or tab guard');
    }
  });

  return results;
}
