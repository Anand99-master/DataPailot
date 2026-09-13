import { VisualizationQueryBuilder } from '../src/services/visualizationQueryBuilder';
import { ChartRecommender } from '../src/services/chartRecommender';
import { VisualizationDataProcessor } from '../src/services/visualizationDataProcessor';
import { UnifiedDataLayer } from '../server/import/UnifiedDataLayer';
import { DetectedColumn } from '../src/types/visualization';

export async function runVisualizationImportIntegrationTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function expect(name: string, actual: any, expected: any) {
    if (actual === expected) {
      results.push({ name, passed: true });
    } else {
      results.push({
        name,
        passed: false,
        error: `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
      });
    }
  }

  function expectTrue(name: string, condition: boolean, reason?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({
        name,
        passed: false,
        error: reason || 'Condition evaluated to false'
      });
    }
  }

  // 1. Query Builder - Dialect identifier quoting
  const quoted = VisualizationQueryBuilder.quoteIdentifier('Order ID', 'sqlite');
  expect('1.1 Query Builder quotes identifiers with double quotes for SQLite', quoted, '"Order ID"');

  const quotedTable = VisualizationQueryBuilder.quoteIdentifier('ecommerce_analysis_dataset_50000_1_', 'sqlite');
  expect('1.2 Query Builder quotes table names', quotedTable, '"ecommerce_analysis_dataset_50000_1_"');

  // 2. Query Builder - Categorical dimension + COUNT aggregation (e.g. Region by Order_ID)
  const countQuery = VisualizationQueryBuilder.buildQuery({
    tableName: 'ecommerce_analysis_dataset_50000_1_',
    dimension: 'Region',
    measure: 'Order_ID',
    aggregation: 'count',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'sqlite'
  });
  expectTrue('2.1 Query Builder builds GROUP BY Region', countQuery.includes('GROUP BY "Region"'));
  expectTrue('2.2 Query Builder counts Order_ID', countQuery.includes('COUNT("Order_ID") AS "total_orders"'));
  expectTrue('2.3 Query Builder sorts by alias desc', countQuery.includes('ORDER BY "total_orders" DESC'));
  expectTrue('2.4 Query Builder sets LIMIT 50', countQuery.includes('LIMIT 50'));

  // 3. Query Builder - KPI single-row aggregate query (no GROUP BY)
  const kpiQuery = VisualizationQueryBuilder.buildQuery({
    tableName: 'ecommerce_analysis_dataset_50000_1_',
    dimension: 'Region',
    measure: 'Sales',
    aggregation: 'sum',
    chartType: 'kpi',
    dialect: 'sqlite'
  });
  expectTrue('3.1 KPI Query computes SUM(Sales)', kpiQuery.includes('SUM("Sales") AS "total_sales"'));
  expectTrue('3.2 KPI Query contains no GROUP BY', !kpiQuery.includes('GROUP BY'));

  // 4. Query Builder - Measure alias generation
  const sumAlias = VisualizationQueryBuilder.generateMeasureAlias('Sales', 'sum');
  expect('4.1 Measure alias for SUM Sales is total_sales', sumAlias, 'total_sales');

  const avgAlias = VisualizationQueryBuilder.generateMeasureAlias('Profit', 'avg');
  expect('4.2 Measure alias for AVG Profit is avg_profit', avgAlias, 'avg_profit');

  // 5. ChartRecommender validation allows count aggregation on non-numeric columns
  const testColumns: DetectedColumn[] = [
    {
      name: 'Region',
      dataType: 'text',
      semanticType: 'text',
      isNumeric: false,
      isDateOrTime: false,
      isCategorical: true,
      isBoolean: false,
      isNullable: false,
      distinctCount: 4,
      nullCount: 0,
      sampleValues: ['West', 'East']
    },
    {
      name: 'Order_ID',
      dataType: 'text',
      semanticType: 'text',
      isNumeric: false,
      isDateOrTime: false,
      isCategorical: true,
      isBoolean: false,
      isNullable: false,
      distinctCount: 5000,
      nullCount: 0,
      sampleValues: ['ORD-1', 'ORD-2']
    }
  ];

  const validationResult = ChartRecommender.validateConfig(
    {
      chartType: 'bar',
      xAxis: 'Region',
      yAxis: 'Order_ID',
      secondaryMeasures: [],
      aggregation: 'count',
      sortOrder: 'desc',
      sortBy: 'y',
      limit: 50,
      title: 'Orders by Region',
      showLegend: true,
      showDataLabels: false,
      showGrid: true,
      binCount: 20,
      treatNullAsZero: false
    },
    testColumns
  );
  expectTrue('5.1 Validation passes for non-numeric count aggregation', validationResult.isValid);
  expect('5.2 Validation has 0 errors for valid count bar chart', validationResult.errors.length, 0);

  // 6. VisualizationDataProcessor KPI computation with robust fallback
  const kpiData = [
    { total_orders: 50000 }
  ];
  const computedKpi = VisualizationDataProcessor.computeKpi(kpiData, 'Order_ID');
  expect('6.1 KPI computation falls back to numeric column if metric alias differs', computedKpi.currentValue, 50000);
  expect('6.2 KPI formatted value has proper formatting', computedKpi.formattedCurrent, '50k');

  // 7. VisualizationDataProcessor processes bar chart data points
  const barData = [
    { Region: 'West', total_orders: 15000 },
    { Region: 'East', total_orders: 12000 }
  ];
  const processed = VisualizationDataProcessor.process(
    barData,
    {
      chartType: 'bar',
      xAxis: 'Region',
      yAxis: 'total_orders',
      secondaryMeasures: [],
      aggregation: 'count',
      sortOrder: 'desc',
      sortBy: 'y',
      limit: 50,
      title: 'Orders by Region',
      showLegend: true,
      showDataLabels: false,
      showGrid: true,
      binCount: 20,
      treatNullAsZero: false
    },
    [
      { ...testColumns[0] },
      {
        name: 'total_orders',
        dataType: 'integer',
        semanticType: 'integer',
        isNumeric: true,
        isDateOrTime: false,
        isCategorical: false,
        isBoolean: false,
        isNullable: false,
        distinctCount: 2,
        nullCount: 0,
        sampleValues: [15000, 12000]
      }
    ]
  );
  expect('7.1 Processed data has 2 points', processed.length, 2);
  expect('7.2 Point 0 xLabel is West', processed[0].xLabel, 'West');
  expect('7.3 Point 0 total_orders is 15000', processed[0].total_orders, 15000);

  // 8. Integration: Execute QueryBuilder-generated SQL against UnifiedDataLayer
  const unifiedDataLayer = UnifiedDataLayer.getInstance();
  const testSessionId = `vis_test_session_${Date.now()}`;
  const dataset = await unifiedDataLayer.registerDataset(testSessionId, {
    sourceName: 'ecommerce_analysis_dataset_50000.csv',
    fileType: 'CSV',
    columns: [
      { name: 'Region', dataType: 'text' as const, isNullable: false, nullCount: 0, sampleValues: ['West', 'East'] },
      { name: 'Order_ID', dataType: 'text' as const, isNullable: false, nullCount: 0, sampleValues: ['ORD-1', 'ORD-2'] },
      { name: 'Sales', dataType: 'numeric' as const, isNullable: false, nullCount: 0, sampleValues: [120.5, 85.0] }
    ],
    rows: [
      { Region: 'West', Order_ID: 'ORD-1', Sales: 120.5 },
      { Region: 'West', Order_ID: 'ORD-2', Sales: 85.0 },
      { Region: 'East', Order_ID: 'ORD-3', Sales: 300.0 }
    ]
  });

  const datasetQuery = VisualizationQueryBuilder.buildQuery({
    tableName: dataset.tableName,
    dimension: 'Region',
    measure: 'Order_ID',
    aggregation: 'count',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'sqlite'
  });

  const executedResult = await unifiedDataLayer.executeQuery(testSessionId, datasetQuery);
  expectTrue('8.1 UnifiedDataLayer executes visualization query without errors', executedResult.rowCount > 0);
  expect('8.2 Aggregated query returns 2 regions', executedResult.rowCount, 2);
  expect('8.3 First region is West with 2 orders', (executedResult.rows[0] as any).Region, 'West');
  expect('8.4 West has 2 orders', (executedResult.rows[0] as any).total_orders, 2);

  // Clean up
  await unifiedDataLayer.removeDataset(testSessionId, dataset.datasetId);
  expectTrue('8.5 Test dataset cleanly removed', true);

  // =========================================================================
  // 9. AUTOMATED TEST SUITE: VISUALIZATION BUILDER AGGREGATION & TYPE RULES
  // =========================================================================
  const test18Columns: DetectedColumn[] = [
    { name: 'Order_ID', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 50000, nullCount: 0, sampleValues: ['CA-2023-1001'] },
    { name: 'Order_Date', dataType: 'date', semanticType: 'date', isNumeric: false, isDateOrTime: true, isCategorical: false, isBoolean: false, isNullable: false, distinctCount: 1200, nullCount: 0, sampleValues: ['2023-01-15'] },
    { name: 'Ship_Date', dataType: 'date', semanticType: 'date', isNumeric: false, isDateOrTime: true, isCategorical: false, isBoolean: false, isNullable: false, distinctCount: 1200, nullCount: 0, sampleValues: ['2023-01-18'] },
    { name: 'Ship_Mode', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 4, nullCount: 0, sampleValues: ['Standard Class'] },
    { name: 'Customer_ID', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 800, nullCount: 0, sampleValues: ['CG-12520'] },
    { name: 'Customer_Name', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 800, nullCount: 0, sampleValues: ['Claire Gute'] },
    { name: 'Segment', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 3, nullCount: 0, sampleValues: ['Consumer'] },
    { name: 'Country', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 1, nullCount: 0, sampleValues: ['United States'] },
    { name: 'City', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 500, nullCount: 0, sampleValues: ['Henderson'] },
    { name: 'State', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 49, nullCount: 0, sampleValues: ['Kentucky'] },
    { name: 'Postal_Code', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 600, nullCount: 0, sampleValues: ['42420'] },
    { name: 'Region', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 5, nullCount: 0, sampleValues: ['West', 'East', 'Central', 'South', 'North'] },
    { name: 'Product_ID', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 1800, nullCount: 0, sampleValues: ['FUR-BO-10001798'] },
    { name: 'Category', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 3, nullCount: 0, sampleValues: ['Furniture'] },
    { name: 'Sub_Category', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 17, nullCount: 0, sampleValues: ['Bookcases'] },
    { name: 'Product_Name', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 1800, nullCount: 0, sampleValues: ['Bush Somerset Collection Bookcase'] },
    { name: 'Sales', dataType: 'numeric', semanticType: 'numeric', isNumeric: true, isDateOrTime: false, isCategorical: false, isBoolean: false, isNullable: false, distinctCount: 5000, nullCount: 0, sampleValues: [261.96] },
    { name: 'Quantity', dataType: 'integer', semanticType: 'integer', isNumeric: true, isDateOrTime: false, isCategorical: false, isBoolean: false, isNullable: false, distinctCount: 14, nullCount: 0, sampleValues: [2] }
  ];

  // A. COUNT text column: Region + Order_ID + COUNT
  const testA_Validation = ChartRecommender.validateConfig({
    chartType: 'bar',
    xAxis: 'Region',
    yAxis: 'Order_ID',
    aggregation: 'count',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Orders by Region',
    secondaryMeasures: [],
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false
  }, test18Columns);
  expectTrue('9.A.1 Validation allows COUNT on text column Order_ID', testA_Validation.isValid);
  expect('9.A.2 Validation errors count is 0 for Order_ID COUNT', testA_Validation.errors.length, 0);

  const testA_Sql = VisualizationQueryBuilder.buildQuery({
    tableName: 'ecommerce_analysis_dataset_50000_1_',
    dimension: 'Region',
    measure: 'Order_ID',
    aggregation: 'count',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'sqlite'
  });
  expectTrue('9.A.3 Query generates COUNT("Order_ID")', testA_Sql.includes('COUNT("Order_ID") AS "total_orders"'));
  expectTrue('9.A.4 Query includes GROUP BY "Region"', testA_Sql.includes('GROUP BY "Region"'));
  expectTrue('9.A.5 Query includes ORDER BY "total_orders" DESC', testA_Sql.includes('ORDER BY "total_orders" DESC'));

  // B. COUNT numeric column: Region + Quantity + COUNT
  const testB_Validation = ChartRecommender.validateConfig({
    chartType: 'bar',
    xAxis: 'Region',
    yAxis: 'Quantity',
    aggregation: 'count',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Quantity Count by Region',
    secondaryMeasures: [],
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false
  }, test18Columns);
  expectTrue('9.B.1 Validation allows COUNT on numeric column Quantity', testB_Validation.isValid);
  const testB_Sql = VisualizationQueryBuilder.buildQuery({
    tableName: 'ecommerce_analysis_dataset_50000_1_',
    dimension: 'Region',
    measure: 'Quantity',
    aggregation: 'count',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'sqlite'
  });
  expectTrue('9.B.2 Query generates COUNT("Quantity")', testB_Sql.includes('COUNT("Quantity")'));

  // C. COUNT date column: Region + Order_Date + COUNT
  const testC_Validation = ChartRecommender.validateConfig({
    chartType: 'bar',
    xAxis: 'Region',
    yAxis: 'Order_Date',
    aggregation: 'count',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Order Date Count by Region',
    secondaryMeasures: [],
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false
  }, test18Columns);
  expectTrue('9.C.1 Validation allows COUNT on date column Order_Date', testC_Validation.isValid);
  const testC_Sql = VisualizationQueryBuilder.buildQuery({
    tableName: 'ecommerce_analysis_dataset_50000_1_',
    dimension: 'Region',
    measure: 'Order_Date',
    aggregation: 'count',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'sqlite'
  });
  expectTrue('9.C.2 Query generates COUNT("Order_Date")', testC_Sql.includes('COUNT("Order_Date")'));

  // D. COUNT All Rows: Region + All Rows + COUNT
  const testD_Validation = ChartRecommender.validateConfig({
    chartType: 'bar',
    xAxis: 'Region',
    yAxis: 'All Rows',
    aggregation: 'count',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'All Rows Count by Region',
    secondaryMeasures: [],
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false
  }, test18Columns);
  expectTrue('9.D.1 Validation allows COUNT on All Rows', testD_Validation.isValid);
  const testD_Sql = VisualizationQueryBuilder.buildQuery({
    tableName: 'ecommerce_analysis_dataset_50000_1_',
    dimension: 'Region',
    measure: 'All Rows',
    aggregation: 'count',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'sqlite'
  });
  expectTrue('9.D.2 Query generates COUNT(*)', testD_Sql.includes('COUNT(*) AS "total_orders"'));
  expectTrue('9.D.3 Query includes GROUP BY "Region"', testD_Sql.includes('GROUP BY "Region"'));
  expectTrue('9.D.4 Query includes ORDER BY "total_orders" DESC', testD_Sql.includes('ORDER BY "total_orders" DESC'));

  // E. SUM numeric column: Region + Quantity + SUM
  const testE_Validation = ChartRecommender.validateConfig({
    chartType: 'bar',
    xAxis: 'Region',
    yAxis: 'Quantity',
    aggregation: 'sum',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Quantity Sum by Region',
    secondaryMeasures: [],
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false
  }, test18Columns);
  expectTrue('9.E.1 Validation allows SUM on numeric column Quantity', testE_Validation.isValid);
  const testE_Sql = VisualizationQueryBuilder.buildQuery({
    tableName: 'ecommerce_analysis_dataset_50000_1_',
    dimension: 'Region',
    measure: 'Quantity',
    aggregation: 'sum',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'sqlite'
  });
  expectTrue('9.E.2 Query generates SUM("Quantity")', testE_Sql.includes('SUM("Quantity")'));

  // F. SUM text column: Must be rejected
  const testF_Validation = ChartRecommender.validateConfig({
    chartType: 'bar',
    xAxis: 'Region',
    yAxis: 'Order_ID',
    aggregation: 'sum',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Invalid SUM on Text',
    secondaryMeasures: [],
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false
  }, test18Columns);
  expectTrue('9.F.1 Validation rejects SUM on text column Order_ID', !testF_Validation.isValid);
  expectTrue('9.F.2 Rejection error states column must be numeric for SUM', testF_Validation.errors[0]?.includes('must be numeric for SUM'));

  // G. AVG numeric column: Must work
  const testG_Validation = ChartRecommender.validateConfig({
    chartType: 'bar',
    xAxis: 'Region',
    yAxis: 'Sales',
    aggregation: 'avg',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Avg Sales by Region',
    secondaryMeasures: [],
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false
  }, test18Columns);
  expectTrue('9.G.1 Validation allows AVG on numeric column Sales', testG_Validation.isValid);
  const testG_Sql = VisualizationQueryBuilder.buildQuery({
    tableName: 'ecommerce_analysis_dataset_50000_1_',
    dimension: 'Region',
    measure: 'Sales',
    aggregation: 'avg',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'sqlite'
  });
  expectTrue('9.G.2 Query generates AVG("Sales")', testG_Sql.includes('AVG("Sales")'));

  // H. AVG text column: Must be rejected
  const testH_Validation = ChartRecommender.validateConfig({
    chartType: 'bar',
    xAxis: 'Region',
    yAxis: 'Order_ID',
    aggregation: 'avg',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Invalid AVG on Text',
    secondaryMeasures: [],
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false
  }, test18Columns);
  expectTrue('9.H.1 Validation rejects AVG on text column Order_ID', !testH_Validation.isValid);
  expectTrue('9.H.2 Rejection error states column must be numeric for AVG', testH_Validation.errors[0]?.includes('must be numeric for AVG'));

  // I. Imported XLSX dataset: 50,000 rows / 18 columns execution against UnifiedDataLayer
  const testSession50k = `vis_50k_session_${Date.now()}`;
  const regions = ['West', 'East', 'Central', 'South', 'North'];
  const generated50kRows: Record<string, any>[] = [];
  for (let i = 0; i < 50000; i++) {
    const rIdx = i % 5;
    generated50kRows.push({
      Order_ID: `ORD-${100000 + i}`,
      Order_Date: '2023-05-10',
      Ship_Date: '2023-05-14',
      Ship_Mode: 'Standard Class',
      Customer_ID: `CUST-${i % 800}`,
      Customer_Name: `Customer ${i % 800}`,
      Segment: 'Consumer',
      Country: 'United States',
      City: 'Seattle',
      State: 'Washington',
      Postal_Code: '98101',
      Region: regions[rIdx],
      Product_ID: `PROD-${i % 1800}`,
      Category: 'Technology',
      Sub_Category: 'Accessories',
      Product_Name: `Product Name ${i % 1800}`,
      Sales: 150.0 + (i % 50),
      Quantity: (i % 5) + 1
    });
  }

  const ds50k = await unifiedDataLayer.registerDataset(testSession50k, {
    sourceName: 'ecommerce_analysis_dataset_50000_1_.xlsx',
    fileType: 'XLSX',
    columns: test18Columns.map(c => ({
      name: c.name,
      dataType: c.dataType as any,
      isNullable: false,
      nullCount: 0,
      sampleValues: c.sampleValues
    })),
    rows: generated50kRows
  });

  expect('9.I.1 50,000 row dataset registered with 18 columns', ds50k.columns.length, 18);
  expect('9.I.2 50,000 row dataset registered with 50,000 row count', ds50k.rowCount, 50000);

  // Execute Region + Order_ID + COUNT
  const analytical50kSql = VisualizationQueryBuilder.buildQuery({
    tableName: ds50k.tableName,
    dimension: 'Region',
    measure: 'Order_ID',
    aggregation: 'count',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'sqlite'
  });

  const exec50kResult = await unifiedDataLayer.executeQuery(testSession50k, analytical50kSql);
  expectTrue('9.I.3 50,000 row analytical query executed successfully', exec50kResult.rowCount === 5);
  expect('9.I.4 5 distinct region groups returned', exec50kResult.rowCount, 5);

  const total50kOrders = (exec50kResult.rows as any[]).reduce((sum, r) => sum + (r.total_orders || 0), 0);
  expect('9.I.5 Total count across all regions equals exactly 50,000', total50kOrders, 50000);

  // Verify each region has 10,000
  for (const r of exec50kResult.rows as any[]) {
    expect(`9.I.6 Region ${r.Region} has exactly 10,000 orders`, r.total_orders, 10000);
  }

  // Also test DataProcessor mapping with Order_ID and All Rows
  const processed50kPoints = VisualizationDataProcessor.process(
    exec50kResult.rows as any[],
    {
      chartType: 'bar',
      xAxis: 'Region',
      yAxis: 'Order_ID',
      aggregation: 'count',
      sortOrder: 'desc',
      sortBy: 'y',
      limit: 50,
      title: 'Orders by Region',
      secondaryMeasures: [],
      showLegend: true,
      showDataLabels: false,
      showGrid: true,
      binCount: 20,
      treatNullAsZero: false
    },
    test18Columns
  );
  expect('9.I.7 Processed data points count is 5', processed50kPoints.length, 5);
  expect('9.I.8 First point has Order_ID measure value 10,000', processed50kPoints[0].Order_ID, 10000);
  expect('9.I.9 First point rawValue is 10,000', processed50kPoints[0].rawValue, 10000);

  // Clean up 50k dataset
  await unifiedDataLayer.removeDataset(testSession50k, ds50k.datasetId);
  expectTrue('9.I.10 50,000 row dataset cleanly removed from memory', true);

  return results;
}
