import { DataQualityService } from '../server/services/DataQualityService';
import { UnifiedDataLayer } from '../server/import/UnifiedDataLayer';
import { DataCleaningService } from '../server/services/DataCleaningService';
import { TransformStep } from '../src/types/cleaning';

export async function runDataQualityImportIntegrationTests(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: message || 'Assertion failed' });
    }
  }

  const uds = UnifiedDataLayer.getInstance();
  const sessionKey = 'test_session_dq_integration';
  const workspaceA = `${sessionKey}:ws_analytics`;
  const workspaceB = `${sessionKey}:ws_finance`;

  try {
    // 1. Setup sample raw messy data
    const messyRows = [
      { id: 1, customer_name: 'Acme Corp', amount: 150.50, order_date: '2023-01-15', email: 'info@acme.com' },
      { id: 2, customer_name: '  Beta LLC  ', amount: -20.00, order_date: 'invalid_date', email: 'sales@beta.com' },
      { id: 3, customer_name: '', amount: null, order_date: '2023-03-10', email: '   ' },
      { id: 4, customer_name: 'Delta Inc', amount: 9999.00, order_date: '2023-04-01', email: 'delta@corp.com' },
      { id: 1, customer_name: 'Acme Corp', amount: 150.50, order_date: '2023-01-15', email: 'info@acme.com' } // Duplicate row
    ];

    const columns = [
      { name: 'id', dataType: 'integer' as const, isNullable: false, nullCount: 0, sampleValues: [] },
      { name: 'customer_name', dataType: 'text' as const, isNullable: true, nullCount: 0, sampleValues: [] },
      { name: 'amount', dataType: 'numeric' as const, isNullable: true, nullCount: 0, sampleValues: [] },
      { name: 'order_date', dataType: 'date' as const, isNullable: true, nullCount: 0, sampleValues: [] },
      { name: 'email', dataType: 'text' as const, isNullable: true, nullCount: 0, sampleValues: [] }
    ];

    const rawDataset = await uds.registerDataset(workspaceA, {
      sourceName: 'messy_data_quality_test',
      fileType: 'CSV',
      columns,
      rows: messyRows,
      workspaceId: 'ws_analytics'
    });

    assert('1.1 Raw dataset registered with matching physical table', !!rawDataset.tableName && rawDataset.rowCount === 5);

    // 2. Profile raw dataset using physical tableName
    const rawProfileByTable = await DataQualityService.profile(workspaceA, 'imported', rawDataset.tableName, true);
    assert('2.1 Profiling raw dataset by physical tableName succeeds', !!rawProfileByTable && rawProfileByTable.totalRows === 5);
    assert('2.2 Duplicate row detected on raw dataset', rawProfileByTable.duplicateRowCount === 1);
    assert('2.3 Quality score is computed', rawProfileByTable.overallQualityScore !== undefined && rawProfileByTable.overallQualityScore < 100);

    // 3. Profile raw dataset using displayName
    const rawProfileByName = await DataQualityService.profile(workspaceA, 'imported', rawDataset.name, true);
    assert('3.1 Profiling raw dataset by displayName succeeds', !!rawProfileByName && rawProfileByName.totalRows === 5);

    // 4. Profile raw dataset using datasetId
    const rawProfileById = await DataQualityService.profile(workspaceA, 'imported', rawDataset.datasetId, true);
    assert('4.1 Profiling raw dataset by datasetId succeeds', !!rawProfileById && rawProfileById.totalRows === 5);

    // 5. Apply Cleaning Pipeline to create 'messy_data_quality_test_cleaned'
    const cleaningSteps: TransformStep[] = [
      {
        id: 'step-1',
        type: 'REMOVE_DUPLICATES',
        description: 'Remove Duplicates',
        enabled: true,
        createdAt: new Date().toISOString(),
        params: { columns: [], keep: 'first' }
      },
      {
        id: 'step-2',
        type: 'TEXT_CLEAN',
        column: 'customer_name',
        description: 'Trim Whitespace in Customer Name',
        enabled: true,
        createdAt: new Date().toISOString(),
        params: { column: 'customer_name', trimWhitespace: true }
      },
      {
        id: 'step-3',
        type: 'FILL_MISSING',
        column: 'customer_name',
        description: 'Fill Missing Customer Name',
        enabled: true,
        createdAt: new Date().toISOString(),
        params: { column: 'customer_name', strategy: 'custom', customValue: 'Unknown Customer' }
      }
    ];

    const cleanResult = await DataCleaningService.saveCleanedDataset(
      workspaceA,
      rawDataset.datasetId,
      'messy_data_quality_test_cleaned',
      cleaningSteps
    );

    const cleanedDataset = cleanResult.newDataset;
    assert('5.1 Cleaned dataset registered successfully', !!cleanedDataset && cleanedDataset.rowCount === 4);

    // 6. Profile Cleaned Dataset using physical tableName
    const cleanedProfile = await DataQualityService.profile(workspaceA, 'imported', cleanedDataset.tableName, true);
    assert('6.1 Profiling cleaned dataset by physical tableName succeeds', !!cleanedProfile && cleanedProfile.totalRows === 4);
    assert('6.2 Duplicate rows eliminated in cleaned dataset profile', cleanedProfile.duplicateRowCount === 0);
    assert('6.3 Quality score improved after cleaning', (cleanedProfile.overallQualityScore || 0) >= (rawProfileByTable.overallQualityScore || 0));

    // 7. Profile Cleaned Dataset using displayName 'messy_data_quality_test_cleaned'
    const cleanedProfileByDisplayName = await DataQualityService.profile(workspaceA, 'imported', 'messy_data_quality_test_cleaned', true);
    assert('7.1 Profiling cleaned dataset by display name succeeds', !!cleanedProfileByDisplayName && cleanedProfileByDisplayName.totalRows === 4);

    // 8. Dataset with special characters in source name
    const specialDataset = await uds.registerDataset(workspaceA, {
      sourceName: 'messy @ data # quality (2024)! test.csv',
      fileType: 'CSV',
      columns,
      rows: messyRows.slice(0, 3),
      workspaceId: 'ws_analytics'
    });

    const specialProfile = await DataQualityService.profile(workspaceA, 'imported', specialDataset.tableName, true);
    assert('8.1 Dataset with special characters profiles by tableName', !!specialProfile && specialProfile.totalRows === 3);

    const specialProfileByDisplay = await DataQualityService.profile(workspaceA, 'imported', specialDataset.name, true);
    assert('8.2 Dataset with special characters profiles by displayName', !!specialProfileByDisplay && specialProfileByDisplay.totalRows === 3);

    // 9. Workspace isolation: dataset in workspaceA must not exist in workspaceB
    let isolatedNotFound = false;
    try {
      await DataQualityService.profile(workspaceB, 'imported', rawDataset.tableName, true);
    } catch (err: any) {
      isolatedNotFound = true;
      assert('9.1 Dataset from workspaceA is inaccessible in workspaceB', err.message.includes('not found') || err.message.includes('unavailable'));
    }
    if (!isolatedNotFound) {
      assert('9.1 Dataset from workspaceA is inaccessible in workspaceB', false, 'Expected workspace isolation error');
    }

    // 10. Missing dataset handling: descriptive error instead of unhandled crash
    let missingHandled = false;
    try {
      await DataQualityService.profile(workspaceA, 'imported', 'non_existent_dataset_table_xyz', true);
    } catch (err: any) {
      missingHandled = true;
      assert('10.1 Graceful descriptive error for non-existent dataset', err.message.includes('not found') || err.message.includes('unavailable'));
    }
    if (!missingHandled) {
      assert('10.1 Graceful descriptive error for non-existent dataset', false, 'Expected error for missing dataset');
    }

  } catch (err: any) {
    assert('Integration test fatal exception', false, err.message);
  }

  return results;
}
