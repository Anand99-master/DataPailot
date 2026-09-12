import { CsvParser } from '../server/import/CsvParser';
import { JsonParser } from '../server/import/JsonParser';
import { ExcelParser } from '../server/import/ExcelParser';
import { ImportSecurity } from '../server/import/ImportSecurity';
import { DataProfiler } from '../server/import/DataProfiler';
import { UnifiedDataLayer } from '../server/import/UnifiedDataLayer';
import * as XLSX from 'xlsx';

export async function runImportWorkflowTests(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: message || 'Assertion failed' });
    }
  }

  const unifiedDataLayer = UnifiedDataLayer.getInstance();
  const testSessionId = `test_session_${Date.now()}`;

  // =========================================================================
  // 1. SECURITY & FORMULA INJECTION (CWE-1236)
  // =========================================================================
  try {
    const maliciousFormulas = [
      '=cmd|\' /C calc\'!A0',
      '+1+2',
      '-2+3',
      '@SUM(1,2)',
      '\tcmd',
      '\rcmd'
    ];

    let allSanitized = true;
    for (const formula of maliciousFormulas) {
      const sanitized = ImportSecurity.sanitizeFormulaInjection(formula);
      if (!sanitized.startsWith("'")) {
        allSanitized = false;
        break;
      }
    }
    assert('1.1 Security: CSV/Excel formula injection (CWE-1236) prefixes formulas with single quote', allSanitized);

    const benignValue = 'Normal Customer Name';
    assert(
      '1.2 Security: Safe text values are unaltered by formula sanitizer',
      ImportSecurity.sanitizeFormulaInjection(benignValue) === benignValue
    );

    const safeTableName = ImportSecurity.toSafeSqlTableName('2024-Q1 Financials (Final)!');
    assert(
      '1.3 Security: Table names sanitized to valid SQL identifiers without dangerous chars',
      /^[a-z_][a-z0-9_]*$/.test(safeTableName) && !safeTableName.includes('-') && !safeTableName.includes('!')
    );

    const extValidation = ImportSecurity.validateExtension('exploit.php.csv');
    assert('1.4 Security: Validates allowable file extension (.csv)', extValidation.isValid && extValidation.fileType === 'CSV');

    const invalidExt = ImportSecurity.validateExtension('dangerous.exe');
    assert('1.5 Security: Rejects non-analytical file extensions (.exe)', !invalidExt.isValid);

    const pathTraversal = ImportSecurity.validateExtension('../../etc/passwd.csv');
    assert('1.6 Security: Rejects path traversal in filename', !pathTraversal.isValid);
  } catch (err: any) {
    assert('1. Security suite exception', false, err.message);
  }

  // =========================================================================
  // 2. CSV PARSER RESILIENCE & TYPE INFERENCE
  // =========================================================================
  try {
    const sampleCsv = `customer_id,name,spend,is_active,signup_date
1,"John Doe",125.50,true,2023-01-15
2,"Jane ""Boss"" Smith",950.00,false,2023-02-20
3,"Acme, Inc.",0.00,true,2023-03-01
4,Unknown,,true,2023-04-10
`;
    const parsedCsv = CsvParser.parse(sampleCsv, {});
    assert('2.1 CSV Parser: Correct row count parsed (4 rows)', parsedCsv.rows.length === 4);
    assert('2.2 CSV Parser: Correct column count (5 columns)', parsedCsv.columns.length === 5);

    const spendCol = parsedCsv.columns.find(c => c.name === 'spend');
    assert('2.3 CSV Parser: Type inference detects numeric for spend', spendCol?.dataType === 'numeric');

    const idCol = parsedCsv.columns.find(c => c.name === 'customer_id');
    assert('2.4 CSV Parser: Type inference detects integer for customer_id', idCol?.dataType === 'integer');

    const activeCol = parsedCsv.columns.find(c => c.name === 'is_active');
    assert('2.5 CSV Parser: Type inference detects boolean for is_active', activeCol?.dataType === 'boolean');

    const dateCol = parsedCsv.columns.find(c => c.name === 'signup_date');
    assert('2.6 CSV Parser: Type inference detects date for signup_date', dateCol?.dataType === 'date');

    const acmeRow = parsedCsv.rows[2];
    assert('2.7 CSV Parser: Escaped quotes and commas preserved', acmeRow['name'] === 'Acme, Inc.');

    // Delimiter auto-detection: semicolon
    const semicolonCsv = `id;dept;budget\n1;Engineering;50000\n2;Marketing;30000\n3;Sales;45000\n`;
    const semiParsed = CsvParser.parse(semicolonCsv, {});
    assert('2.8 CSV Parser: Auto-detects semicolon delimiter', semiParsed.delimiter === ';' && semiParsed.columns.length === 3);

    // Delimiter auto-detection: tab-delimited (TSV)
    const tsvText = `id\tproduct\tprice\n101\tWidget\t19.99\n102\tGadget\t29.99\n`;
    const tsvParsed = CsvParser.parse(tsvText, {});
    assert('2.9 CSV Parser: Auto-detects tab delimiter', tsvParsed.delimiter === '\t' && tsvParsed.rows.length === 2);
  } catch (err: any) {
    assert('2. CSV suite exception', false, err.message);
  }

  // =========================================================================
  // 3. JSON PARSER RESILIENCE
  // =========================================================================
  try {
    const sampleJsonArray = JSON.stringify([
      { id: 1, product: 'Laptop', specs: { ram: 16, cpu: 'M3' }, price: 1299.99, in_stock: true },
      { id: 2, product: 'Keyboard', specs: { ram: null, cpu: null }, price: 89.50, in_stock: true },
      { id: 3, product: 'Monitor', specs: { ram: null, cpu: 'Display' }, price: 349.00, in_stock: false }
    ]);

    const parsedJson = JsonParser.parse(sampleJsonArray);
    assert('3.1 JSON Parser: Flattens or parses array of objects', parsedJson.rows.length === 3);
    assert('3.2 JSON Parser: Column names identified', parsedJson.columns.some(c => c.name === 'product'));
    assert('3.3 JSON Parser: Nested fields flattened or preserved', parsedJson.columns.some(c => c.name.startsWith('specs')));

    // JSON Lines (NDJSON) format
    const ndjson = `{"order_id": 501, "total": 45.00}\n{"order_id": 502, "total": 92.50}\n`;
    const parsedNdjson = JsonParser.parse(ndjson);
    assert('3.4 JSON Parser: Supports newline-delimited JSON (NDJSON)', parsedNdjson.rows.length === 2);
  } catch (err: any) {
    assert('3. JSON suite exception', false, err.message);
  }

  // =========================================================================
  // 4. EXCEL (XLSX) PARSER RESILIENCE
  // =========================================================================
  try {
    // Generate an in-memory XLSX workbook with 2 sheets using the xlsx library
    const wb = XLSX.utils.book_new();
    const ws1Data = [
      ['Region', 'Q1_Sales', 'Q2_Sales'],
      ['North', 15000, 18000],
      ['South', 12000, 14500],
      ['East', 22000, 24000]
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    XLSX.utils.book_append_sheet(wb, ws1, 'Sales_2024');

    const ws2Data = [
      ['Region', 'Manager'],
      ['North', 'Alice'],
      ['South', 'Bob']
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    XLSX.utils.book_append_sheet(wb, ws2, 'Managers');

    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsedExcel = ExcelParser.parse(xlsxBuffer, { sheetName: 'Sales_2024' });
    assert('4.1 Excel Parser: Enumerates all workbook sheets', parsedExcel.sheetNames.length === 2 && parsedExcel.sheetNames.includes('Managers'));
    assert('4.2 Excel Parser: Parses selected sheet data rows', parsedExcel.rows.length === 3);
    assert('4.3 Excel Parser: Infers numeric types for sales columns', parsedExcel.columns.find(c => c.name === 'Q1_Sales')?.dataType === 'integer');
  } catch (err: any) {
    assert('4. Excel suite exception', false, err.message);
  }

  // =========================================================================
  // 5. UNIFIED DATA LAYER LIFECYCLE (REGISTER, PROFILE, INTROSPECT, EXPORT)
  // =========================================================================
  let customerDatasetId = '';
  let customerTableName = '';

  try {
    // Register Dataset 1: Customers
    const customerColumns = [
      { name: 'customer_id', dataType: 'integer' as const, isNullable: false, nullCount: 0, sampleValues: [1, 2, 3] },
      { name: 'name', dataType: 'text' as const, isNullable: false, nullCount: 0, sampleValues: ['Alice', 'Bob', 'Charlie'] },
      { name: 'segment', dataType: 'text' as const, isNullable: false, nullCount: 0, sampleValues: ['Enterprise', 'SMB', 'SMB'] },
      { name: 'annual_spend', dataType: 'numeric' as const, isNullable: true, nullCount: 0, sampleValues: [12000.5, 4500.0, 8900.2] }
    ];

    const customerRows = [
      { customer_id: 1, name: 'Alice Enterprise', segment: 'Enterprise', annual_spend: 12000.5 },
      { customer_id: 2, name: 'Bob Bakery', segment: 'SMB', annual_spend: 4500.0 },
      { customer_id: 3, name: 'Charlie Cafe', segment: 'SMB', annual_spend: 8900.2 },
      { customer_id: 4, name: 'David Dental', segment: 'SMB', annual_spend: 1500.0 },
      { customer_id: 5, name: 'Echo Tech', segment: 'Enterprise', annual_spend: 35000.0 }
    ];

    const dataset = await unifiedDataLayer.registerDataset(testSessionId, {
      sourceName: 'customers_dataset.csv',
      fileType: 'CSV',
      columns: customerColumns,
      rows: customerRows,
      fileSize: 1024
    });

    customerDatasetId = dataset.datasetId;
    customerTableName = dataset.tableName;

    assert('5.1 UDL: Dataset successfully registered with datasetId', Boolean(customerDatasetId));
    assert('5.2 UDL: Table name assigned in SQLite memory store', Boolean(customerTableName));
    assert('5.3 UDL: Row count accurately recorded (5 rows)', dataset.rowCount === 5);

    // Profiling verification
    assert('5.4 UDL: Profiling generated for all columns', Boolean(dataset.profile?.columns['annual_spend']));
    const spendProfile = dataset.profile?.columns['annual_spend'];
    assert('5.5 UDL: Profiling computes accurate min/max', spendProfile?.min === 1500.0 && spendProfile?.max === 35000.0);
    assert('5.6 UDL: Profiling computes positive average', typeof spendProfile?.average === 'number' && spendProfile.average > 10000);

    // Register Dataset 2: Orders (to test JOINs)
    const orderColumns = [
      { name: 'order_id', dataType: 'integer' as const, isNullable: false, nullCount: 0, sampleValues: [101, 102] },
      { name: 'customer_id', dataType: 'integer' as const, isNullable: false, nullCount: 0, sampleValues: [1, 2] },
      { name: 'order_value', dataType: 'numeric' as const, isNullable: false, nullCount: 0, sampleValues: [250.0, 500.0] }
    ];
    const orderRows = [
      { order_id: 101, customer_id: 1, order_value: 2500.0 },
      { order_id: 102, customer_id: 1, order_value: 4500.0 },
      { order_id: 103, customer_id: 2, order_value: 1200.0 },
      { order_id: 104, customer_id: 3, order_value: 3200.0 }
    ];
    const ordersDataset = await unifiedDataLayer.registerDataset(testSessionId, {
      sourceName: 'orders_dataset.csv',
      fileType: 'CSV',
      columns: orderColumns,
      rows: orderRows
    });

    // Discovery list check
    const discovered = unifiedDataLayer.listDiscoveredTables(testSessionId);
    assert('5.7 UDL: listDiscoveredTables includes both imported tables', discovered.length >= 2);
    assert('5.8 UDL: Discovered table schema is "imported"', discovered.every(t => t.schema === 'imported'));

    // Table Details introspection
    const tableDetails = unifiedDataLayer.getTableDetails(testSessionId, customerTableName);
    assert('5.9 UDL: Introspects table columns and types', Boolean(tableDetails && tableDetails.columns.length === 4));
    assert('5.10 UDL: Introspects row count', tableDetails?.approximateRowCount === 5);

    // Data Preview
    const preview = unifiedDataLayer.getDataPreview(testSessionId, customerDatasetId, 10);
    assert('5.11 UDL: Generates data preview rows', preview !== null && preview.rows.length === 5);

    // Rename dataset
    const renameRes = unifiedDataLayer.renameDataset(testSessionId, customerDatasetId, 'VIP Customers');
    assert('5.12 UDL: Renaming updates dataset display name', renameRes !== null && renameRes.name === 'VIP Customers');

    // Export: CSV
    const csvExport = unifiedDataLayer.exportDataset(testSessionId, customerDatasetId, 'csv');
    assert('5.13 UDL: Exports dataset to CSV format', csvExport !== null && typeof csvExport.content === 'string' && csvExport.content.includes('Alice Enterprise'));

    // Export: JSON
    const jsonExport = unifiedDataLayer.exportDataset(testSessionId, customerDatasetId, 'json');
    assert('5.14 UDL: Exports dataset to JSON format', jsonExport !== null && typeof jsonExport.content === 'string' && jsonExport.content.includes('Alice Enterprise'));

    // Export: XLSX
    const xlsxExport = unifiedDataLayer.exportDataset(testSessionId, customerDatasetId, 'xlsx');
    assert('5.15 UDL: Exports dataset to XLSX buffer', xlsxExport !== null && Buffer.isBuffer(xlsxExport.content));

    // Operation capabilities
    const capabilities = unifiedDataLayer.getOperationCapabilities(testSessionId, customerDatasetId);
    assert(
      '5.16 UDL: Returns full operation support capabilities matrix',
      capabilities.length > 10 && capabilities.some(c => c.operation === 'Filtering' && c.status === 'SUPPORTED')
    );
  } catch (err: any) {
    assert('5. UDL lifecycle suite exception', false, err.message);
  }

  // =========================================================================
  // 6. QUERY EXECUTION & ANALYSIS TOOLKIT INTEGRATION
  // =========================================================================
  try {
    // 6.1 Basic SELECT query execution
    const selectRes = await unifiedDataLayer.executeQuery(
      testSessionId,
      `SELECT name, segment, annual_spend FROM "${customerTableName}" ORDER BY annual_spend DESC LIMIT 3;`
    );
    assert('6.1 Query Exec: Executes SELECT query on imported dataset', selectRes.rows.length === 3);
    assert('6.2 Query Exec: First row is highest spender (Echo Tech)', selectRes.rows[0]['name'] === 'Echo Tech');

    // 6.2 Aggregation & GROUP BY
    const aggRes = await unifiedDataLayer.executeQuery(
      testSessionId,
      `SELECT segment, COUNT(*) as cnt, AVG(annual_spend) as avg_spend FROM "${customerTableName}" GROUP BY segment ORDER BY cnt DESC;`
    );
    assert('6.3 Query Exec: Executes GROUP BY and aggregation query', aggRes.rows.length === 2);
    const smbRow = aggRes.rows.find(r => r['segment'] === 'SMB');
    assert('6.4 Query Exec: SMB count is 3', Number(smbRow?.['cnt']) === 3);

    // 6.3 Window Functions
    const winRes = await unifiedDataLayer.executeQuery(
      testSessionId,
      `SELECT name, annual_spend, RANK() OVER (ORDER BY annual_spend DESC) as rank_num FROM "${customerTableName}";`
    );
    assert('6.4 Query Exec: Supports Window Function (RANK() OVER)', winRes.rows.length === 5 && Number(winRes.rows[0]['rank_num']) === 1);

    // 6.4 JOIN between two imported datasets
    const ordersTable = unifiedDataLayer.getDatasets(testSessionId).find(d => d.sourceName === 'orders_dataset.csv')?.tableName;
    const joinRes = await unifiedDataLayer.executeQuery(
      testSessionId,
      `SELECT c.name, o.order_id, o.order_value
       FROM "${customerTableName}" c
       INNER JOIN "${ordersTable}" o ON c.customer_id = o.customer_id
       ORDER BY o.order_value DESC;`
    );
    assert('6.5 Query Exec: Executes relational JOIN across multiple imported files', joinRes.rows.length === 4);
    assert('6.6 Query Exec: JOIN returns matched customer name', Boolean(joinRes.rows[0]['name']));

    // 6.5 Query Safety: Rejection of destructive statements
    try {
      await unifiedDataLayer.executeQuery(
        testSessionId,
        `DROP TABLE "${customerTableName}";`
      );
      assert('6.7 Query Safety: Rejects DROP TABLE statement with safety error', false, 'DROP TABLE should be rejected');
    } catch (err: any) {
      assert('6.7 Query Safety: Rejects DROP TABLE statement with safety error', err.message.includes('safety violation') || err.message.includes('Read-only Mode'));
    }

    try {
      await unifiedDataLayer.executeQuery(
        testSessionId,
        `INSERT INTO "${customerTableName}" (customer_id, name) VALUES (999, 'Hacker');`
      );
      assert('6.8 Query Safety: Rejects INSERT statement with safety error', false, 'INSERT should be rejected');
    } catch (err: any) {
      assert('6.8 Query Safety: Rejects INSERT statement with safety error', err.message.includes('safety violation') || err.message.includes('Read-only Mode'));
    }
  } catch (err: any) {
    assert('6. Query execution suite exception', false, err.message);
  }

  // =========================================================================
  // 7. SESSION ISOLATION & CLEANUP
  // =========================================================================
  try {
    const otherSessionId = `other_session_${Date.now()}`;
    const otherDiscovered = unifiedDataLayer.listDiscoveredTables(otherSessionId);
    assert('7.1 Session Isolation: Separate session has zero tables initially', otherDiscovered.length === 0);

    // Delete dataset
    const deleteSuccess = unifiedDataLayer.deleteDataset(testSessionId, customerDatasetId);
    assert('7.2 Teardown: Successfully deleted imported dataset', deleteSuccess);

    const remainingTables = unifiedDataLayer.listDiscoveredTables(testSessionId);
    assert('7.3 Teardown: Deleted table removed from discovered tables', !remainingTables.some(t => t.name === customerTableName));
  } catch (err: any) {
    assert('7. Session isolation suite exception', false, err.message);
  }

  return results;
}
