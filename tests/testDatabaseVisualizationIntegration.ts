import { VisualizationQueryBuilder } from '../src/services/visualizationQueryBuilder';
import { ColumnTypeDetector } from '../src/services/columnTypeDetector';
import { VisualizationDataProcessor } from '../src/services/visualizationDataProcessor';
import { ChartRecommender } from '../src/services/chartRecommender';
import { SQLiteAdapter } from '../server/database/SQLiteAdapter';
import { QuerySafetyValidator } from '../server/database/QuerySafetyValidator';
import { UnifiedDataLayer } from '../server/import/UnifiedDataLayer';
import { DetectedColumn, ChartConfig } from '../src/types/visualization';
import fs from 'fs';
import path from 'path';

export async function runDatabaseVisualizationIntegrationTests() {
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

  // =========================================================================
  // 1. DIALECT-AWARE DATABASE TABLE QUERY BUILDER
  // =========================================================================
  // 1.1 PostgreSQL table with schema qualification
  const pgQuery = VisualizationQueryBuilder.buildQuery({
    schema: 'public',
    tableName: 'customers',
    dimension: 'country',
    measure: 'id',
    aggregation: 'count',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 25,
    dialect: 'postgres'
  });
  expectTrue('1.1 PostgreSQL builds schema-qualified table query', pgQuery.includes('FROM "public"."customers"'));
  expectTrue('1.2 PostgreSQL quotes identifiers and groups', pgQuery.includes('GROUP BY "country"'));
  expectTrue('1.3 PostgreSQL limits rows with LIMIT 25', pgQuery.includes('LIMIT 25'));

  // 1.4 MySQL table query building (backticks)
  const mysqlQuery = VisualizationQueryBuilder.buildQuery({
    schema: 'ecommerce',
    tableName: 'orders',
    dimension: 'status',
    measure: 'total_amount',
    aggregation: 'sum',
    chartType: 'pie',
    sortOrder: 'desc',
    limit: 10,
    dialect: 'mysql'
  });
  expectTrue('1.4 MySQL builds backtick-quoted table query', mysqlQuery.includes('FROM `ecommerce`.`orders`'));
  expectTrue('1.5 MySQL sums measure with alias', mysqlQuery.includes('SUM(`total_amount`) AS `total_total_amount`'));

  // 1.6 SQL Server TOP N query building
  const mssqlQuery = VisualizationQueryBuilder.buildQuery({
    schema: 'dbo',
    tableName: 'sales_records',
    dimension: 'region',
    measure: 'revenue',
    aggregation: 'avg',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 50,
    dialect: 'mssql'
  });
  expectTrue('1.6 MSSQL uses TOP 50 in SELECT clause', mssqlQuery.includes('SELECT TOP 50') && mssqlQuery.includes('[region]'));
  expectTrue('1.7 MSSQL formats schema as [dbo].[sales_records]', mssqlQuery.includes('FROM [dbo].[sales_records]'));

  // 1.8 Oracle FETCH FIRST query building
  const oracleQuery = VisualizationQueryBuilder.buildQuery({
    schema: 'HR',
    tableName: 'EMPLOYEES',
    dimension: 'DEPARTMENT_ID',
    measure: 'SALARY',
    aggregation: 'max',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 15,
    dialect: 'oracle'
  });
  expectTrue('1.8 Oracle uses FETCH FIRST 15 ROWS ONLY', oracleQuery.includes('FETCH FIRST 15 ROWS ONLY'));
  expectTrue('1.9 Oracle formats schema as "HR"."EMPLOYEES"', oracleQuery.includes('FROM "HR"."EMPLOYEES"'));

  // =========================================================================
  // 2. READ-ONLY SAFETY VALIDATION FOR GENERATED DATABASE QUERIES
  // =========================================================================
  const safePg = QuerySafetyValidator.validate(pgQuery);
  expectTrue('2.1 Generated PostgreSQL query is safe and read-only', safePg.isValid);

  const safeMysql = QuerySafetyValidator.validate(mysqlQuery);
  expectTrue('2.2 Generated MySQL query is safe and read-only', safeMysql.isValid);

  const safeMssql = QuerySafetyValidator.validate(mssqlQuery);
  expectTrue('2.3 Generated MSSQL query is safe and read-only', safeMssql.isValid);

  const safeOracle = QuerySafetyValidator.validate(oracleQuery);
  expectTrue('2.4 Generated Oracle query is safe and read-only', safeOracle.isValid);

  // Injected DROP TABLE query is rejected
  const maliciousQuery = 'SELECT * FROM "public"."customers"; DROP TABLE "public"."customers";';
  const unsafeValidation = QuerySafetyValidator.validate(maliciousQuery);
  expectTrue('2.5 Injected DROP TABLE query is rejected by safety validator', !unsafeValidation.isValid);

  // =========================================================================
  // 3. COLUMN TYPE DETECTION & SMART RECOMMENDATIONS FOR DATABASE SCHEMA
  // =========================================================================
  const dbTableColumns = [
    { name: 'id', dataType: 'integer', isNullable: false },
    { name: 'customer_name', dataType: 'varchar(255)', isNullable: false },
    { name: 'signup_date', dataType: 'date', isNullable: true },
    { name: 'lifetime_value', dataType: 'numeric(10,2)', isNullable: true },
    { name: 'is_active', dataType: 'boolean', isNullable: false }
  ];

  const detectedCols = ColumnTypeDetector.fromTableColumns(dbTableColumns);
  expect('3.1 Detects 5 columns from table schema', detectedCols.length, 5);

  const nameCol = detectedCols.find(c => c.name === 'customer_name')!;
  expectTrue('3.2 customer_name is detected as categorical', nameCol.isCategorical);

  const dateCol = detectedCols.find(c => c.name === 'signup_date')!;
  expectTrue('3.3 signup_date is detected as dateOrTime', dateCol.isDateOrTime);

  const ltvCol = detectedCols.find(c => c.name === 'lifetime_value')!;
  expectTrue('3.4 lifetime_value is detected as numeric', ltvCol.isNumeric);

  const primaryRec = ChartRecommender.recommend(detectedCols, 100);
  expectTrue('3.5 Generates smart primary chart recommendation for database table schema', !!primaryRec);
  expectTrue('3.6 Recommends valid chart type (bar, line, etc.)', ['bar', 'line', 'pie', 'table'].includes(primaryRec.chartType));

  // =========================================================================
  // 4. REAL DATABASE TABLE FLOW: CUSTOMERS & ORDERS FIXTURE EXECUTION & CHART RENDERING
  // =========================================================================
  const testDbDir = path.join(process.cwd(), '.tmp-test-vis-db');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
  const testDbFile = path.join(testDbDir, 'vis_customers_test.sqlite');
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  fs.writeFileSync(testDbFile, '');

  const adapter = new SQLiteAdapter({
    type: 'sqlite',
    filePath: testDbFile
  });
  await adapter.connect();

  // Seed sample database tables: customers and orders
  await (adapter as any).db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      customer_name TEXT,
      country TEXT,
      city TEXT,
      lifetime_value REAL,
      signup_date TEXT
    );
    INSERT INTO customers (customer_name, country, city, lifetime_value, signup_date) VALUES
      ('Acme Corp', 'USA', 'New York', 45000.00, '2025-01-10'),
      ('GlobalTech', 'USA', 'San Francisco', 72000.00, '2025-02-15'),
      ('NordicSoft', 'Sweden', 'Stockholm', 31000.50, '2025-03-20'),
      ('TokyoByte', 'Japan', 'Tokyo', 89000.00, '2025-04-12'),
      ('EuroBank', 'Germany', 'Frankfurt', 62000.75, '2025-05-08');

    CREATE TABLE orders (
      order_id INTEGER PRIMARY KEY,
      customer_id INTEGER,
      order_status TEXT,
      order_total REAL,
      order_date TEXT
    );
    INSERT INTO orders (customer_id, order_status, order_total, order_date) VALUES
      (1, 'completed', 1500.00, '2026-01-05'),
      (1, 'completed', 3200.00, '2026-01-15'),
      (2, 'completed', 5400.00, '2026-02-01'),
      (3, 'shipped', 2100.00, '2026-02-10'),
      (4, 'completed', 9800.00, '2026-03-01'),
      (5, 'pending', 4300.00, '2026-03-15');
  `);

  // Introspect table columns
  const tableCols = await adapter.getTableColumns('main', 'customers');
  expectTrue('4.1 Introspected 6 columns for customers table', tableCols.length === 6);

  // Build and execute analytical query on `customers` table
  const customersVisSql = VisualizationQueryBuilder.buildQuery({
    tableName: 'customers',
    dimension: 'country',
    measure: 'lifetime_value',
    aggregation: 'sum',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 10,
    dialect: 'sqlite'
  });

  const custQueryExec = await adapter.executeReadOnlyQuery(customersVisSql);
  expectTrue('4.2 Customers analytical query executed successfully', custQueryExec.rows.length === 4);

  // Process data using VisualizationDataProcessor
  const custChartConfig: ChartConfig = {
    chartType: 'bar',
    xAxis: 'country',
    yAxis: 'lifetime_value',
    secondaryMeasures: [],
    aggregation: 'sum',
    sortBy: 'y',
    sortOrder: 'desc',
    limit: 10,
    title: 'Lifetime Value by Country',
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 10,
    treatNullAsZero: true
  };

  const detectedCustCols = ColumnTypeDetector.detect(custQueryExec.columns, custQueryExec.rows);
  const custProcessedPoints = VisualizationDataProcessor.process(custQueryExec.rows, custChartConfig, detectedCustCols);

  expectTrue('4.3 Processed chart points has 4 distinct country buckets', custProcessedPoints.length === 4);
  expectTrue('4.4 Highest LTV country is USA with $117,000', custProcessedPoints[0].xLabel === 'USA' && Math.abs(custProcessedPoints[0].rawValue - 117000) < 0.1);

  // Verify KPI Query on `customers`
  const kpiSql = VisualizationQueryBuilder.buildQuery({
    tableName: 'customers',
    measure: 'lifetime_value',
    aggregation: 'sum',
    chartType: 'kpi',
    dialect: 'sqlite'
  });
  const kpiRes = await adapter.executeReadOnlyQuery(kpiSql);
  expectTrue('4.5 Total customer LTV KPI returns single row', kpiRes.rows.length === 1);
  const totalLtv = Number((kpiRes.rows[0] as any).total_lifetime_value);
  expectTrue('4.6 Total customer LTV is $299,001.25', Math.abs(totalLtv - 299001.25) < 0.1);

  // =========================================================================
  // 5. CLEANED / DERIVED DATABASE DATASET VISUALIZATION FLOW
  // =========================================================================
  const udl = UnifiedDataLayer.getInstance();
  const testSessionKey = 'test_cleaned_vis_session';

  // Simulate cleaning: filter completed orders into a derived dataset
  const completedOrders = custQueryExec.rows.filter(r => Number((r as any).total_lifetime_value) > 40000);
  const derivedDataset = await udl.registerDataset(testSessionKey, {
    sourceName: 'high_value_customers.csv',
    fileType: 'CSV',
    sourceType: 'DATABASE',
    sourceTable: 'customers',
    isDerived: true,
    columns: [
      { name: 'country', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['USA', 'Sweden'] },
      { name: 'total_lifetime_value', dataType: 'numeric', isNullable: true, nullCount: 0, sampleValues: [117000, 31000] }
    ],
    rows: completedOrders
  });

  expectTrue('5.1 Cleaned/derived dataset registered in UnifiedDataLayer', !!derivedDataset.datasetId);

  // Query and visualize the derived dataset
  const derivedSql = VisualizationQueryBuilder.buildQuery({
    tableName: derivedDataset.tableName,
    dimension: 'country',
    measure: 'total_lifetime_value',
    aggregation: 'sum',
    chartType: 'bar',
    sortOrder: 'desc',
    dialect: 'sqlite'
  });

  const derivedQueryRes = await udl.executeQuery(testSessionKey, derivedSql);
  expectTrue('5.2 Analytical query executes against cleaned/derived dataset', derivedQueryRes.rows.length > 0);

  const derivedProcessed = VisualizationDataProcessor.process(
    derivedQueryRes.rows,
    {
      chartType: 'bar',
      xAxis: 'country',
      yAxis: 'total_lifetime_value',
      secondaryMeasures: [],
      aggregation: 'sum',
      sortBy: 'y',
      sortOrder: 'desc',
      limit: 10,
      title: 'High Value Customers',
      showLegend: true,
      showDataLabels: false,
      showGrid: true,
      binCount: 10,
      treatNullAsZero: true
    },
    ColumnTypeDetector.detect(derivedQueryRes.columns, derivedQueryRes.rows)
  );

  expectTrue('5.3 Cleaned/derived chart data points rendered successfully', derivedProcessed.length > 0);

  // Teardown
  await udl.removeDataset(testSessionKey, derivedDataset.datasetId);
  await adapter.disconnect();
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });

  return results;
}
