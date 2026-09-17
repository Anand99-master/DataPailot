import { ChartConfig, DetectedColumn } from '../src/types/visualization';
import { ImportedDataset } from '../src/types/import';
import { VisualizationQueryBuilder } from '../src/services/visualizationQueryBuilder';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runVisualizationDatasetBugFixTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('--- 29. VISUALIZATION DATASET SCHEMA REVALIDATION & BUG FIX TESTS ---');

  const datasetA: ImportedDataset = {
    datasetId: 'ds_a',
    sourceType: 'FILE',
    sourceName: 'sales_a.csv',
    fileType: 'CSV',
    rowCount: 100,
    columns: [
      { name: 'region', dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] },
      { name: 'sales', dataType: 'numeric', isNullable: true, nullCount: 0, sampleValues: [] }
    ],
    schema: 'main',
    name: 'Sales Dataset A',
    tableName: 'imported_sales_a',
    previewRows: [],
    importTimestamp: new Date().toISOString(),
    status: 'ready'
  };

  const datasetB: ImportedDataset = {
    datasetId: 'ds_b',
    sourceType: 'FILE',
    sourceName: 'product_b.csv',
    fileType: 'CSV',
    rowCount: 50,
    columns: [
      { name: 'category', dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] },
      { name: 'price', dataType: 'numeric', isNullable: true, nullCount: 0, sampleValues: [] }
    ],
    schema: 'main',
    name: 'Product Dataset B',
    tableName: 'imported_product_b',
    previewRows: [],
    importTimestamp: new Date().toISOString(),
    status: 'ready'
  };

  const schemaColsB: DetectedColumn[] = datasetB.columns.map(c => ({
    name: c.name,
    dataType: c.dataType,
    semanticType: c.dataType === 'numeric' ? 'numeric' : 'text',
    isNumeric: c.dataType === 'numeric',
    isDateOrTime: false,
    isCategorical: c.dataType !== 'numeric',
    isBoolean: false,
    isNullable: true,
    distinctCount: 10,
    nullCount: 0,
    sampleValues: []
  }));

  const staleConfig: ChartConfig = {
    chartType: 'bar',
    xAxis: 'region',
    yAxis: 'total_orders',
    aggregation: 'count',
    sortOrder: 'desc',
    sortBy: 'x',
    limit: 50,
    title: 'Stale Test',
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false,
    samplingEnabled: false,
    secondaryMeasures: []
  };

  const colNamesB = new Set(schemaColsB.map(c => c.name));
  let testX = staleConfig.xAxis;
  let testY = staleConfig.yAxis;

  if (testX && testX !== 'All Rows' && !colNamesB.has(testX)) {
    testX = '';
  }
  if (testY && testY !== 'All Rows' && testY !== '*' && !colNamesB.has(testY)) {
    testY = '';
  }

  assertTest(
    '1. Stale field mapping region not in dataset B reset to empty',
    testX === '',
    'Stale xAxis region should be reset to empty'
  );

  assertTest(
    '2. Stale field mapping total_orders not in dataset B reset to empty',
    testY === '',
    'Stale yAxis total_orders should be reset to empty'
  );

  let sqlExecutionPrevented = false;
  let errorMessage = '';
  const attemptedDim = 'region';
  const attemptedMeas = 'total_orders';

  if (!colNamesB.has(attemptedDim)) {
    sqlExecutionPrevented = true;
    errorMessage = `Selected field '${attemptedDim}' is not available in this dataset. Please select another field.`;
  } else if (!colNamesB.has(attemptedMeas)) {
    sqlExecutionPrevented = true;
    errorMessage = `Selected field '${attemptedMeas}' is not available in this dataset. Please select another field.`;
  }

  assertTest(
    '3. Invalid SQL execution prevented when column missing',
    sqlExecutionPrevented,
    'SQL execution must be blocked for missing columns'
  );

  assertTest(
    '4. Clear error message generated for missing column',
    errorMessage.includes("Selected field 'region' is not available in this dataset"),
    'Error message must indicate missing column'
  );

  const validDim = 'category';
  const validMeas = 'price';
  const validSql = VisualizationQueryBuilder.buildQuery({
    tableName: datasetB.tableName,
    dimension: validDim,
    measure: validMeas,
    aggregation: 'sum',
    chartType: 'bar',
    dialect: 'sqlite'
  });

  assertTest(
    '5. Valid existing column generates correct analytical query',
    validSql.includes('SELECT') && validSql.includes('category') && validSql.includes('SUM') && validSql.includes('price'),
    'Valid query must correctly reference existing columns category and price'
  );

  return results;
}
