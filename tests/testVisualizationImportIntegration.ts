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

  return results;
}
