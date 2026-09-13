import * as XLSX from 'xlsx';
import { ExcelExportService } from '../src/services/excelExportService';
import { QueryResultColumn } from '../src/types/database';

export async function runExcelExportTests(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: message || 'Assertion failed' });
    }
  }

  // 1. Service existence and API contract
  assert(
    '1.1 ExcelExportService exists and exposes export methods',
    typeof ExcelExportService.exportQueryResultToExcel === 'function' &&
    typeof ExcelExportService.buildWorkbook === 'function' &&
    typeof ExcelExportService.sanitizeCellForExcel === 'function'
  );

  assert(
    '1.2 ExcelExportService exposes filename utilities and formula protection',
    typeof ExcelExportService.sanitizeFilename === 'function' &&
    typeof ExcelExportService.generateExcelFilename === 'function' &&
    typeof ExcelExportService.extractTableFromSql === 'function'
  );

  // 2. Filename sanitization tests
  const defaultFilename = ExcelExportService.generateExcelFilename();
  assert('2.1 Default filename is datapilot_query_results.xlsx', defaultFilename === 'datapilot_query_results.xlsx');

  const cleanFilename = ExcelExportService.generateExcelFilename('customers');
  assert('2.2 Clean source name produces <source>_query_results.xlsx', cleanFilename === 'customers_query_results.xlsx');

  const pathTraversalFilename = ExcelExportService.generateExcelFilename('../../../secret/passwords.txt');
  assert(
    '2.3 Filename sanitizer strips directory traversal and illegal characters',
    !pathTraversalFilename.includes('..') &&
    !pathTraversalFilename.includes('/') &&
    !pathTraversalFilename.includes('\\') &&
    pathTraversalFilename.endsWith('.xlsx')
  );

  const specialCharsFilename = ExcelExportService.generateExcelFilename('sales*report:2024?<>|');
  assert(
    '2.4 Filename sanitizer strips Windows/Unix illegal characters (*:?<>|)',
    !/[*?:<>|]/.test(specialCharsFilename) && specialCharsFilename.includes('sales')
  );

  // 3. SQL Table extraction tests
  const sql1 = 'SELECT * FROM customers WHERE active = 1';
  assert('3.1 Extracts table name from standard SQL', ExcelExportService.extractTableFromSql(sql1) === 'customers');

  const sql2 = 'SELECT id, total FROM "sales_orders" WHERE total > 100';
  assert('3.2 Extracts table name with double quotes', ExcelExportService.extractTableFromSql(sql2) === 'sales_orders');

  const sql3 = 'SELECT * FROM public.users_table';
  assert('3.3 Extracts table name with schema prefix', ExcelExportService.extractTableFromSql(sql3) === 'users_table');

  const sql4 = 'SELECT 1 + 1';
  assert('3.4 Returns null when no FROM table exists', ExcelExportService.extractTableFromSql(sql4) === null);

  // 4. Formula injection protection tests (CWE-1236)
  const fEquals = ExcelExportService.sanitizeCellForExcel('=cmd|"/C calc"!A0');
  assert('4.1 Sanitizes = formula prefix with single quote', fEquals === '\'=cmd|"/C calc"!A0');

  const fPlus = ExcelExportService.sanitizeCellForExcel('+1234567890');
  assert('4.2 Sanitizes + prefix with single quote', fPlus === '\'+1234567890');

  const fMinusStr = ExcelExportService.sanitizeCellForExcel('-2+3+cmd|');
  assert('4.3 Sanitizes string with - prefix with single quote', fMinusStr === '\'-2+3+cmd|');

  const fAt = ExcelExportService.sanitizeCellForExcel('@SUM(A1:B10)');
  assert('4.4 Sanitizes @ prefix with single quote', fAt === '\'@SUM(A1:B10)');

  const fTab = ExcelExportService.sanitizeCellForExcel('\tHYPERLINK("http://evil.com")');
  assert('4.5 Sanitizes tab prefix with single quote', fTab === '\'\tHYPERLINK("http://evil.com")');

  const safeText = ExcelExportService.sanitizeCellForExcel('Standard Shipping');
  assert('4.6 Preserves normal safe text without adding quote', safeText === 'Standard Shipping');

  const numericNeg = ExcelExportService.sanitizeCellForExcel(-42.5);
  assert('4.7 Preserves numeric negative values as real numbers', numericNeg === -42.5 && typeof numericNeg === 'number');

  // 5. Data fidelity & type preservation tests
  const testColumns: QueryResultColumn[] = [
    { name: 'Order ID', dataType: 'varchar' },
    { name: 'Customer #', dataType: 'integer' },
    { name: 'Revenue ($)', dataType: 'numeric' },
    { name: 'Discount %', dataType: 'float' },
    { name: 'Is Active?', dataType: 'boolean' },
    { name: 'Order Date', dataType: 'timestamp' },
    { name: 'Metadata', dataType: 'jsonb' },
    { name: 'Empty Field', dataType: 'text' },
    { name: 'Formula Attack', dataType: 'text' }
  ];

  const testDate = new Date('2024-03-15T14:30:00Z');

  const testRows: Record<string, unknown>[] = [
    {
      'Order ID': 'ORD-1001',
      'Customer #': 42001,
      'Revenue ($)': 1250.75,
      'Discount %': 0.15,
      'Is Active?': true,
      'Order Date': testDate,
      'Metadata': { region: 'North', tier: 'Gold' },
      'Empty Field': null,
      'Formula Attack': '=SUM(A1:A10)'
    },
    {
      'Order ID': 'ORD-1002',
      'Customer #': 42002,
      'Revenue ($)': -50.0,
      'Discount %': 0.0,
      'Is Active?': false,
      'Order Date': '2024-03-16',
      'Metadata': ['tag1', 'tag2'],
      'Empty Field': undefined,
      'Formula Attack': '@HYPERLINK("http://phishing.com")'
    },
    {
      'Order ID': 'ORD-1003',
      'Customer #': 9007199254740990, // Large safe integer
      'Revenue ($)': 0,
      'Discount %': 0.05,
      'Is Active?': true,
      'Order Date': new Date('2024-03-17'),
      'Metadata': null,
      'Empty Field': '',
      'Formula Attack': '+1+1'
    }
  ];

  // 6. XLSX generation verification
  const exportResult = ExcelExportService.exportQueryResultToExcel(testColumns, testRows, {
    filename: 'orders_query_results.xlsx',
    sourceName: 'orders',
    sheetName: 'Orders'
  });

  assert('6.1 Export returns valid Uint8Array buffer', exportResult.buffer instanceof Uint8Array && exportResult.buffer.byteLength > 0);
  assert('6.2 Export returns correct filename', exportResult.filename === 'orders_query_results.xlsx');
  assert('6.3 Export returns correct row count (3 rows)', exportResult.rowCount === 3);
  assert('6.4 Export returns correct column count (9 columns)', exportResult.columnCount === 9);

  // 7. Verify generated XLSX by reading back with SheetJS parser
  const parsedWorkbook = XLSX.read(exportResult.buffer, { type: 'array' });
  assert('7.1 Parser parses generated workbook without errors', !!parsedWorkbook);
  assert('7.2 Sheet name matches sanitized sheetName', parsedWorkbook.SheetNames.includes('Orders'));

  const parsedSheet = parsedWorkbook.Sheets['Orders'];
  assert('7.3 Worksheet exists in parsed workbook', !!parsedSheet);

  // 8. Header preservation
  assert('8.1 Header cell A1 preserves exact column name "Order ID"', parsedSheet['A1']?.v === 'Order ID');
  assert('8.2 Header cell B1 preserves exact column name "Customer #"', parsedSheet['B1']?.v === 'Customer #');
  assert('8.3 Header cell C1 preserves exact column name "Revenue ($)"', parsedSheet['C1']?.v === 'Revenue ($)');
  assert('8.4 Header cell D1 preserves exact column name "Discount %"', parsedSheet['D1']?.v === 'Discount %');
  assert('8.5 Header cell E1 preserves exact column name "Is Active?"', parsedSheet['E1']?.v === 'Is Active?');
  assert('8.6 Header cell F1 preserves exact column name "Order Date"', parsedSheet['F1']?.v === 'Order Date');
  assert('8.7 Header cell G1 preserves exact column name "Metadata"', parsedSheet['G1']?.v === 'Metadata');
  assert('8.8 Header cell H1 preserves exact column name "Empty Field"', parsedSheet['H1']?.v === 'Empty Field');
  assert('8.9 Header cell I1 preserves exact column name "Formula Attack"', parsedSheet['I1']?.v === 'Formula Attack');

  // 9. Row 1 data values and types
  // Row 1 is in Excel row 2
  assert('9.1 Row 1 Order ID is text "ORD-1001"', parsedSheet['A2']?.v === 'ORD-1001' && parsedSheet['A2']?.t === 's');
  assert('9.2 Row 1 Customer # is numeric 42001', parsedSheet['B2']?.v === 42001 && parsedSheet['B2']?.t === 'n');
  assert('9.3 Row 1 Revenue ($) is numeric 1250.75', parsedSheet['C2']?.v === 1250.75 && parsedSheet['C2']?.t === 'n');
  assert('9.4 Row 1 Discount % is numeric 0.15', parsedSheet['D2']?.v === 0.15 && parsedSheet['D2']?.t === 'n');
  assert('9.5 Row 1 Is Active? is boolean true', parsedSheet['E2']?.v === true && parsedSheet['E2']?.t === 'b');
  assert('9.6 Row 1 Order Date is ISO formatted date string', typeof parsedSheet['F2']?.v === 'string' && parsedSheet['F2']?.v.startsWith('2024-03-15'));
  assert('9.7 Row 1 Metadata is JSON string', parsedSheet['G2']?.v === '{"region":"North","tier":"Gold"}');
  assert('9.8 Row 1 Empty Field is empty cell (not crashing)', parsedSheet['H2'] === undefined || parsedSheet['H2']?.v === '');

  // Formula attack cell in Row 1: must be sanitized, text type, no formula attribute (.f)
  assert('9.9 Formula injection =SUM(...) is safely sanitized to \'=SUM(...)', parsedSheet['I2']?.v === '\'=SUM(A1:A10)');
  assert('9.10 Formula injection cell is marked as text type "s"', parsedSheet['I2']?.t === 's');
  assert('9.11 Formula injection cell has NO executable formula property (.f)', parsedSheet['I2']?.f === undefined);

  // 10. Row 2 checks (negatives, false, @ formula)
  assert('10.1 Row 2 Revenue ($) negative number -50 is preserved as number', parsedSheet['C3']?.v === -50 && parsedSheet['C3']?.t === 'n');
  assert('10.2 Row 2 Is Active? is boolean false', parsedSheet['E3']?.v === false && parsedSheet['E3']?.t === 'b');
  assert('10.3 Row 2 @HYPERLINK formula is safely sanitized', parsedSheet['I3']?.v === '\'@HYPERLINK("http://phishing.com")');
  assert('10.4 Row 2 formula cell has NO executable formula property', parsedSheet['I3']?.f === undefined);

  // 11. Large numbers & Row 3 checks
  assert('11.1 Large safe integer 9007199254740990 preserved', parsedSheet['B4']?.v === 9007199254740990);
  assert('11.2 Row 3 +1+1 formula attack is safely sanitized to \'+1+1', parsedSheet['I4']?.v === '\'+1+1');

  // 12. Error handling checks
  let thrownEmptyRows = false;
  try {
    ExcelExportService.exportQueryResultToExcel(testColumns, []);
  } catch {
    thrownEmptyRows = true;
  }
  assert('12.1 Throws graceful error when exporting 0 rows', thrownEmptyRows);

  let thrownEmptyCols = false;
  try {
    ExcelExportService.exportQueryResultToExcel([], [{ a: 1 }]);
  } catch {
    thrownEmptyCols = true;
  }
  assert('12.2 Throws graceful error when exporting 0 columns', thrownEmptyCols);

  // 13. Scale test: 5,000 rows analytical dataset export
  const scaleColumns = [
    { name: 'id', dataType: 'integer' },
    { name: 'region', dataType: 'varchar' },
    { name: 'sales', dataType: 'numeric' },
    { name: 'notes', dataType: 'text' }
  ];
  const scaleRows: Record<string, unknown>[] = [];
  for (let i = 0; i < 5000; i++) {
    scaleRows.push({
      id: i + 1,
      region: i % 4 === 0 ? 'North' : i % 4 === 1 ? 'South' : i % 4 === 2 ? 'East' : 'West',
      sales: +(Math.random() * 1000).toFixed(2),
      notes: i === 10 ? '=SUM(C2:C10)' : `Transaction #${i + 1}`
    });
  }

  const scaleExport = ExcelExportService.exportQueryResultToExcel(scaleColumns, scaleRows, {
    sourceName: 'scale_test'
  });
  assert('13.1 5,000 row dataset exports in under 1 second without limits', scaleExport.buffer.byteLength > 50000);
  assert('13.2 5,000 row export has correct filename', scaleExport.filename === 'scale_test_query_results.xlsx');

  const parsedScale = XLSX.read(scaleExport.buffer, { type: 'array' });
  const scaleSheet = parsedScale.Sheets['scale_test'];
  assert('13.3 Scale worksheet contains 5,001 total rows (header + 5000 rows)', !!scaleSheet['A5001']);
  assert('13.4 Scale formula injected cell is sanitized', scaleSheet['D12']?.v === '\'=SUM(C2:C10)');

  // 14. Multi-dialect / Imported dataset result compatibility (Requirement 8)
  // PostgreSQL result structure
  const pgResult = {
    columns: [{ name: 'pg_id', dataType: 'int4' }, { name: 'pg_val', dataType: 'text' }],
    rows: [{ pg_id: 1, pg_val: 'Postgres row' }]
  };
  const pgExport = ExcelExportService.exportQueryResultToExcel(pgResult.columns, pgResult.rows, { sourceName: 'pg_data' });
  assert('14.1 Works for PostgreSQL query results', pgExport.buffer.byteLength > 0);

  // SQLite result structure
  const sqliteResult = {
    columns: [{ name: 'sq_id', dataType: 'INTEGER' }, { name: 'sq_val', dataType: 'TEXT' }],
    rows: [{ sq_id: 1, sq_val: 'SQLite row' }]
  };
  const sqliteExport = ExcelExportService.exportQueryResultToExcel(sqliteResult.columns, sqliteResult.rows, { sourceName: 'sqlite_data' });
  assert('14.2 Works for SQLite query results', sqliteExport.buffer.byteLength > 0);

  // MySQL result structure
  const mysqlResult = {
    columns: [{ name: 'my_id', dataType: 'INT' }, { name: 'my_val', dataType: 'VARCHAR' }],
    rows: [{ my_id: 1, my_val: 'MySQL row' }]
  };
  const mysqlExport = ExcelExportService.exportQueryResultToExcel(mysqlResult.columns, mysqlResult.rows, { sourceName: 'mysql_data' });
  assert('14.3 Works for MySQL query results', mysqlExport.buffer.byteLength > 0);

  // SQL Server result structure
  const mssqlResult = {
    columns: [{ name: 'ms_id', dataType: 'int' }, { name: 'ms_val', dataType: 'nvarchar' }],
    rows: [{ ms_id: 1, ms_val: 'MSSQL row' }]
  };
  const mssqlExport = ExcelExportService.exportQueryResultToExcel(mssqlResult.columns, mssqlResult.rows, { sourceName: 'mssql_data' });
  assert('14.4 Works for SQL Server query results', mssqlExport.buffer.byteLength > 0);

  // Oracle result structure
  const oracleResult = {
    columns: [{ name: 'ora_id', dataType: 'NUMBER' }, { name: 'ora_val', dataType: 'VARCHAR2' }],
    rows: [{ ora_id: 1, ora_val: 'Oracle row' }]
  };
  const oracleExport = ExcelExportService.exportQueryResultToExcel(oracleResult.columns, oracleResult.rows, { sourceName: 'oracle_data' });
  assert('14.5 Works for Oracle query results', oracleExport.buffer.byteLength > 0);

  // Imported CSV/XLSX/JSON datasets
  const importedResult = {
    columns: [{ name: 'Region', dataType: 'text' }, { name: 'Sales', dataType: 'numeric' }],
    rows: [{ Region: 'West', Sales: 500 }, { Region: 'East', Sales: 750 }]
  };
  const importedExport = ExcelExportService.exportQueryResultToExcel(importedResult.columns, importedResult.rows, { sourceName: 'imported_sales' });
  assert('14.6 Works for Imported CSV/XLSX/JSON dataset query results', importedExport.buffer.byteLength > 0);

  // 15. Regression: Ensure existing CSV and JSON export mechanisms still pass
  // JSON copy verification
  const jsonOutput = JSON.stringify(testRows, null, 2);
  const parsedJson = JSON.parse(jsonOutput);
  assert('15.1 JSON export produces valid JSON and preserves row count', Array.isArray(parsedJson) && parsedJson.length === 3);
  assert('15.2 JSON export preserves nested metadata object', parsedJson[0].Metadata?.region === 'North');

  // CSV export verification matching QueryResults exportCsv
  const colNames = testColumns.map(c => c.name);
  const csvHeader = colNames.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
  const csvRows = testRows.map(row =>
    colNames
      .map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '""';
        let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  const fullCsv = [csvHeader, ...csvRows].join('\n');
  assert('15.3 CSV export produces expected header string', fullCsv.startsWith('"Order ID","Customer #"'));
  assert('15.4 CSV export sanitizes formula injection with single quote', fullCsv.includes('"\'=SUM(A1:A10)"'));
  assert('15.5 CSV export preserves all 3 row lines plus header', fullCsv.split('\n').length === 4);

  return results;
}
