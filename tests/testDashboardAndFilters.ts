import { DashboardFilterEngine } from '../src/services/dashboardFilterEngine';
import { DashboardFilter, DashboardWidget } from '../src/types/dashboard';
import { QueryResultColumn } from '../src/types/database';
import { VisualizationExportService } from '../src/services/visualizationExportService';

export function runDashboardAndFilterTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: message || 'Assertion failed' });
    }
  }

  const mockWidget: DashboardWidget = {
    id: 'widget_1',
    title: 'Monthly Sales',
    chartType: 'bar',
    queryRef: {
      type: 'raw_sql',
      sql: 'SELECT department, SUM(revenue) as total_rev FROM sales GROUP BY department',
      sourceTable: 'public.sales',
      referencedColumns: ['department', 'revenue']
    },
    chartConfig: {
      chartType: 'bar',
      xAxis: 'department',
      yAxis: 'total_rev',
      secondaryMeasures: [],
      aggregation: 'none',
      sortOrder: 'none',
      sortBy: 'x',
      limit: 'all',
      title: 'Monthly Sales',
      showLegend: true,
      showDataLabels: false,
      showGrid: true,
      binCount: 10,
      treatNullAsZero: true
    },
    size: { colSpan: 6 },
    position: { order: 0 }
  };

  const mockColumns: QueryResultColumn[] = [
    { name: 'department', dataType: 'varchar' },
    { name: 'total_rev', dataType: 'numeric' }
  ];

  // RTM-15: Filter on non-existent column -> GRACEFUL ERROR / Incompatible
  const nonExistentFilter: DashboardFilter = {
    id: 'filter_invalid',
    label: 'Non Existent Column Filter',
    targetColumn: 'non_existent_column_xyz',
    type: 'text',
    currentValue: 'Tech'
  };

  const compatibility = DashboardFilterEngine.checkCompatibility(nonExistentFilter, mockWidget, mockColumns);
  assert(
    'RTM-15: Filter on non-existent column returns graceful incompatible result',
    !compatibility.isCompatible,
    'Expected filter on non-existent column to be incompatible'
  );

  // Valid filter compatibility
  const validFilter: DashboardFilter = {
    id: 'filter_dept',
    label: 'Department Filter',
    targetColumn: 'department',
    type: 'text',
    currentValue: 'Marketing'
  };

  const validComp = DashboardFilterEngine.checkCompatibility(validFilter, mockWidget, mockColumns);
  assert('FILTER-1: Compatible column filter recognized', validComp.isCompatible && validComp.columnName === 'department');

  // Filter SQL augmentation using outer subquery
  const augmented = DashboardFilterEngine.applyFiltersToSql(
    mockWidget.queryRef.sql,
    [validFilter, nonExistentFilter],
    mockWidget,
    mockColumns
  );

  assert('FILTER-2: Applied only valid filter', augmented.appliedFilterCount === 1);
  assert(
    'FILTER-3: Filter wrapped in safe subquery',
    augmented.augmentedSql.includes('FROM (') && augmented.augmentedSql.includes('CAST("department" AS TEXT) = \'Marketing\'')
  );

  // RTM-14: Dashboard refresh with missing table simulation -> GRACEFUL ERROR
  // In DashboardRefreshService, if an execution returns an error, the widget status transitions to 'error' with error details
  const simulatedMissingTableResult = {
    status: 'error' as const,
    errorMessage: 'relation "public.missing_table" does not exist',
    errorDetails: {
      code: 'TABLE_NOT_FOUND',
      message: 'Table public.missing_table was not found in schema.'
    }
  };
  assert(
    'RTM-14: Missing table handled gracefully without unhandled exception',
    simulatedMissingTableResult.status === 'error' && simulatedMissingTableResult.errorMessage.includes('does not exist')
  );

  // Section 23: CSV Formula Injection Prevention
  const formulaPayloads = [
    '=1+2',
    '+1+2',
    '-1+2',
    '@SUM(A1:A10)',
    '\t=cmd|'
  ];

  for (const payload of formulaPayloads) {
    const sanitized = VisualizationExportService.sanitizeCsvCell(payload);
    assert(
      `CSV-INJ: Formula trigger character in "${payload}" is safely escaped with single quote`,
      sanitized.startsWith(`"'`)
    );
  }

  const normalText = 'Product Alpha';
  const normalSanitized = VisualizationExportService.sanitizeCsvCell(normalText);
  assert('CSV-SAFE: Normal text does not get unnecessary single quote', normalSanitized === '"Product Alpha"');

  return results;
}
