import { VisualizationQueryBuilder } from '../src/services/visualizationQueryBuilder';
import { ColumnTypeDetector } from '../src/services/columnTypeDetector';
import { VisualizationDataProcessor } from '../src/services/visualizationDataProcessor';
import { ChartRecommender } from '../src/services/chartRecommender';
import { SQLiteAdapter } from '../server/database/SQLiteAdapter';
import { QuerySafetyValidator } from '../server/database/QuerySafetyValidator';
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
  // 2. CHART TYPES QUERY GENERATION FOR DATABASE TABLES
  // =========================================================================
  // 2.1 KPI Metric Query
  const kpiQuery = VisualizationQueryBuilder.buildQuery({
    schema: 'public',
    tableName: 'transactions',
    measure: 'amount',
    aggregation: 'sum',
    chartType: 'kpi',
    dialect: 'postgres'
  });
  expectTrue('2.1 Single KPI metric query has no GROUP BY', !kpiQuery.includes('GROUP BY'));
  expectTrue('2.2 KPI metric query computes SUM(amount)', kpiQuery.includes('SUM("amount") AS "total_amount"'));

  // 2.2 Scatter Plot Query
  const scatterQuery = VisualizationQueryBuilder.buildQuery({
    schema: 'public',
    tableName: 'analytics_events',
    dimension: 'page_views',
    measure: 'session_duration',
    chartType: 'scatter',
    limit: 300,
    dialect: 'postgres'
  });
  expectTrue('2.3 Scatter plot queries X and Y with NOT NULL guard', scatterQuery.includes('WHERE "page_views" IS NOT NULL AND "session_duration" IS NOT NULL'));
  expectTrue('2.4 Scatter plot limits results to 300', scatterQuery.includes('LIMIT 300'));

  // 2.3 Histogram Query
  const histQuery = VisualizationQueryBuilder.buildQuery({
    schema: 'public',
    tableName: 'orders',
    measure: 'freight_cost',
    chartType: 'histogram',
    limit: 500,
    dialect: 'postgres'
  });
  expectTrue('2.5 Histogram queries values with value alias', histQuery.includes('"freight_cost" AS "value"'));
  expectTrue('2.6 Histogram filters NOT NULL values', histQuery.includes('WHERE "freight_cost" IS NOT NULL'));

  // =========================================================================
  // 3. READ-ONLY SECURITY GUARD FOR VISUALIZATION QUERIES
  // =========================================================================
  // 3.1 All generated queries are valid SELECT queries
  const safeValidation = QuerySafetyValidator.validate(pgQuery);
  expectTrue('3.1 Generated PostgreSQL analytical query is safe and read-only', safeValidation.isValid);

  const safeKpi = QuerySafetyValidator.validate(kpiQuery);
  expectTrue('3.2 Generated KPI query is safe and read-only', safeKpi.isValid);

  // 3.3 Ensure destructive DDL/DML injection is blocked
  const maliciousQuery = 'SELECT * FROM "public"."customers"; DROP TABLE "public"."customers";';
  const unsafeValidation = QuerySafetyValidator.validate(maliciousQuery);
  expectTrue('3.3 Injected DROP TABLE query is rejected by safety validator', !unsafeValidation.isValid);

  // =========================================================================
  // 4. COLUMN TYPE DETECTION & SMART RECOMMENDATIONS FOR DATABASE SCHEMA
  // =========================================================================
  const dbTableColumns = [
    { name: 'id', dataType: 'integer', isNullable: false },
    { name: 'customer_name', dataType: 'varchar(255)', isNullable: false },
    { name: 'signup_date', dataType: 'date', isNullable: true },
    { name: 'lifetime_value', dataType: 'numeric(10,2)', isNullable: true },
    { name: 'is_active', dataType: 'boolean', isNullable: false }
  ];

  const detectedCols = ColumnTypeDetector.fromTableColumns(dbTableColumns);
  expect('4.1 Detects 5 columns from table schema', detectedCols.length, 5);

  const nameCol = detectedCols.find(c => c.name === 'customer_name')!;
  expectTrue('4.2 customer_name is detected as categorical', nameCol.isCategorical);

  const dateCol = detectedCols.find(c => c.name === 'signup_date')!;
  expectTrue('4.3 signup_date is detected as dateOrTime', dateCol.isDateOrTime);

  const ltvCol = detectedCols.find(c => c.name === 'lifetime_value')!;
  expectTrue('4.4 lifetime_value is detected as numeric', ltvCol.isNumeric);

  // Smart Recommendations
  const primaryRec = ChartRecommender.recommend(detectedCols, 100);
  expectTrue('4.5 Generates smart primary chart recommendation for database table schema', !!primaryRec);
  expectTrue('4.6 Recommends valid chart type (bar, line, etc.)', ['bar', 'line', 'pie', 'table'].includes(primaryRec.chartType));

  const validation = ChartRecommender.validateConfig({
    chartType: 'bar',
    xAxis: 'customer_name',
    yAxis: 'lifetime_value',
    secondaryMeasures: [],
    aggregation: 'sum',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Customer LTV',
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 10,
    treatNullAsZero: true
  }, detectedCols);
  expectTrue('4.7 Validates chart configuration successfully', validation.isValid);

  // =========================================================================
  // 5. LIVE SQLITE DATABASE ADAPTER EXECUTION FOR TABLE VISUALIZATION
  // =========================================================================
  const testDbDir = path.join(process.cwd(), '.tmp-test-vis-db');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });
  const testDbFile = path.join(testDbDir, 'vis_test.sqlite');
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  fs.writeFileSync(testDbFile, '');

  const adapter = new SQLiteAdapter({
    type: 'sqlite',
    filePath: testDbFile
  });
  await adapter.connect();

  // Seed sample database table
  await (adapter as any).db.exec(`
    CREATE TABLE sales_data (
      id INTEGER PRIMARY KEY,
      region TEXT,
      revenue REAL,
      units_sold INTEGER,
      order_date TEXT
    );
    INSERT INTO sales_data (region, revenue, units_sold, order_date) VALUES
      ('North', 15000.50, 120, '2026-01-15'),
      ('North', 22000.00, 180, '2026-01-20'),
      ('South', 18500.25, 140, '2026-01-18'),
      ('East',  31000.75, 250, '2026-01-22'),
      ('West',  12400.00, 95,  '2026-01-25');
  `);

  // Build and execute analytical query on database table
  const visQuery = VisualizationQueryBuilder.buildQuery({
    tableName: 'sales_data',
    dimension: 'region',
    measure: 'revenue',
    aggregation: 'sum',
    chartType: 'bar',
    sortOrder: 'desc',
    limit: 10,
    dialect: 'sqlite'
  });

  const queryExecResult = await adapter.executeReadOnlyQuery(visQuery);
  expectTrue('5.1 Read-only analytical query executes on database table successfully', queryExecResult.rows.length === 4);
  expectTrue('5.2 Results are grouped by region with sum of revenue', (queryExecResult.rows[0] as any).region === 'North' || (queryExecResult.rows[0] as any).region === 'East');

  // Verify KPI execution on database table
  const dbKpiQuery = VisualizationQueryBuilder.buildQuery({
    tableName: 'sales_data',
    measure: 'revenue',
    aggregation: 'sum',
    chartType: 'kpi',
    dialect: 'sqlite'
  });
  const kpiResult = await adapter.executeReadOnlyQuery(dbKpiQuery);
  expectTrue('5.3 KPI query returns total revenue single row', kpiResult.rows.length === 1);
  const totalRev = Number((kpiResult.rows[0] as any).total_revenue);
  expectTrue('5.4 Computed total revenue is ~98901.5', Math.abs(totalRev - 98901.5) < 0.1);

  // Clean up
  await adapter.disconnect();
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });

  // =========================================================================
  // 6. IN-MEMORY VISUALIZATION DATA PROCESSOR (FOR SQL RESULTS & CLIENT-SIDE)
  // =========================================================================
  const rawRows = [
    { department: 'Engineering', salary: 120000, tenure: 3 },
    { department: 'Engineering', salary: 140000, tenure: 5 },
    { department: 'Marketing',   salary: 95000,  tenure: 2 },
    { department: 'Marketing',   salary: 105000, tenure: 4 },
    { department: 'Sales',       salary: 110000, tenure: 3 }
  ];

  const chartConfig: ChartConfig = {
    chartType: 'bar',
    xAxis: 'department',
    yAxis: 'salary',
    secondaryMeasures: [],
    aggregation: 'avg',
    sortBy: 'y',
    sortOrder: 'desc',
    limit: 10,
    title: 'Avg Salary by Dept',
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 10,
    treatNullAsZero: true
  };

  const processedData = VisualizationDataProcessor.process(rawRows, chartConfig, [
    { name: 'department', dataType: 'text', semanticType: 'text', isNumeric: false, isDateOrTime: false, isCategorical: true, isBoolean: false, isNullable: false, distinctCount: 3, nullCount: 0, sampleValues: [] },
    { name: 'salary', dataType: 'numeric', semanticType: 'numeric', isNumeric: true, isDateOrTime: false, isCategorical: false, isBoolean: false, isNullable: false, distinctCount: 5, nullCount: 0, sampleValues: [] }
  ]);

  expectTrue('6.1 In-memory processor processes data points', processedData.length > 0);
  expectTrue('6.2 Processed points have xLabel populated', !!processedData[0].xLabel);

  return results;
}
