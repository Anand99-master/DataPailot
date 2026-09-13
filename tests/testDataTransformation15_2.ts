import { ExpressionEngine } from '../src/utils/expressionEngine';
import { DataCleaningEngine } from '../src/utils/dataCleaningEngine';
import { ColumnMetadata } from '../src/types/import';
import { TransformStep } from '../src/types/cleaning';

export async function runDataTransformation15_2Tests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
      console.log(`  ✓ ${name}`);
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  console.log('\n--- 18. ADVANCED DATA TRANSFORMATION WORKSPACE (15.2) ---');

  // =========================================================================
  // 1. EXPRESSION ENGINE & AST EVALUATION (ZERO EVAL)
  // =========================================================================

  test('ExpressionEngine: parses and computes simple arithmetic', () => {
    const ast = ExpressionEngine.parse('10 + 5 * 2');
    const res = ExpressionEngine.evaluate(ast, {});
    if (res !== 20) throw new Error(`Expected 20, got ${res}`);
  });

  test('ExpressionEngine: respects parentheses and power operator', () => {
    const ast = ExpressionEngine.parse('(2 + 3) ^ 2');
    const res = ExpressionEngine.evaluate(ast, {});
    if (res !== 25) throw new Error(`Expected 25, got ${res}`);
  });

  test('ExpressionEngine: handles column identifiers with and without brackets', () => {
    const ast = ExpressionEngine.parse('[Sales] * (1 - [Discount Rate])');
    const row = { 'Sales': 200, 'Discount Rate': 0.1 };
    const res = ExpressionEngine.evaluate(ast, row);
    if (res !== 180) throw new Error(`Expected 180, got ${res}`);
  });

  test('ExpressionEngine: evaluates logical IF function', () => {
    const ast = ExpressionEngine.parse('IF([Score] >= 80, "Distinction", "Pass")');
    const res1 = ExpressionEngine.evaluate(ast, { Score: 95 });
    const res2 = ExpressionEngine.evaluate(ast, { Score: 65 });
    if (res1 !== 'Distinction') throw new Error(`Expected Distinction, got ${res1}`);
    if (res2 !== 'Pass') throw new Error(`Expected Pass, got ${res2}`);
  });

  test('ExpressionEngine: evaluates ROUND and ABS functions', () => {
    const ast1 = ExpressionEngine.parse('ROUND(123.4567, 2)');
    const res1 = ExpressionEngine.evaluate(ast1, {});
    if (res1 !== 123.46) throw new Error(`Expected 123.46, got ${res1}`);

    const ast2 = ExpressionEngine.parse('ABS(-45.8)');
    const res2 = ExpressionEngine.evaluate(ast2, {});
    if (res2 !== 45.8) throw new Error(`Expected 45.8, got ${res2}`);
  });

  test('ExpressionEngine: evaluates string functions UPPER, LOWER, TRIM, CONCAT', () => {
    const ast = ExpressionEngine.parse('CONCAT(UPPER(TRIM([First])), " ", LOWER([Last]))');
    const res = ExpressionEngine.evaluate(ast, { First: '  alice ', Last: 'SMITH' });
    if (res !== 'ALICE smith') throw new Error(`Expected "ALICE smith", got "${res}"`);
  });

  test('ExpressionEngine: evaluates COALESCE function on null/missing fields', () => {
    const ast = ExpressionEngine.parse('COALESCE([NullableVal], 0) + 10');
    const res1 = ExpressionEngine.evaluate(ast, { NullableVal: null });
    const res2 = ExpressionEngine.evaluate(ast, { NullableVal: 5 });
    if (res1 !== 10) throw new Error(`Expected 10, got ${res1}`);
    if (res2 !== 15) throw new Error(`Expected 15, got ${res2}`);
  });

  test('ExpressionEngine: handles division by zero safely without throwing', () => {
    const ast = ExpressionEngine.parse('[Sales] / [Units]');
    const res = ExpressionEngine.evaluate(ast, { Sales: 100, Units: 0 });
    if (res !== null) throw new Error(`Expected null on div by zero, got ${res}`);
  });

  test('ExpressionEngine: validates expression and extracts referenced columns', () => {
    const val = ExpressionEngine.validate('[Sales] - [Cost] + [Tax]', ['Sales', 'Cost', 'Tax', 'Region']);
    if (!val.valid) throw new Error(`Validation failed: ${val.error}`);
    if (val.referencedColumns.length !== 3) throw new Error(`Expected 3 columns, got ${val.referencedColumns.length}`);
  });

  // =========================================================================
  // 2. ADVANCED COLUMN OPERATIONS
  // =========================================================================

  const sampleCols: ColumnMetadata[] = [
    { name: 'id', dataType: 'integer', isNullable: false, nullCount: 0, sampleValues: [1, 2, 3] },
    { name: 'full_name', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['Alice', 'Bob'] },
    { name: 'category', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['Tech', 'Furniture'] },
    { name: 'revenue', dataType: 'numeric', isNullable: false, nullCount: 0, sampleValues: [1500, 800] },
    { name: 'cost', dataType: 'numeric', isNullable: false, nullCount: 0, sampleValues: [900, 600] },
    { name: 'order_date', dataType: 'date', isNullable: false, nullCount: 0, sampleValues: ['2024-03-15'] }
  ];

  const sampleRows: Record<string, unknown>[] = [
    { id: 1, full_name: 'Alice Johnson', category: 'Tech', revenue: 1500, cost: 900, order_date: '2024-03-15' },
    { id: 2, full_name: 'Bob Smith', category: 'Furniture', revenue: 800, cost: 600, order_date: '2024-06-20' },
    { id: 3, full_name: 'Charlie Brown', category: 'Tech', revenue: 2200, cost: 1200, order_date: '2024-09-05' },
    { id: 4, full_name: 'Diana Prince', category: 'Furniture', revenue: 1100, cost: 700, order_date: '2024-11-12' }
  ];

  test('DataCleaningEngine: RENAME_COLUMN updates records and schema', () => {
    const res = DataCleaningEngine.renameColumn(
      sampleRows,
      { oldName: 'revenue', newName: 'sales_amount' },
      sampleCols
    );
    if (!res.rows[0].sales_amount || 'revenue' in res.rows[0]) {
      throw new Error('Rename failed in rows');
    }
    if (!res.columns.some(c => c.name === 'sales_amount')) {
      throw new Error('Rename failed in column metadata');
    }
  });

  test('DataCleaningEngine: DROP_COLUMN removes targeted columns', () => {
    const res = DataCleaningEngine.dropColumn(
      sampleRows,
      { columns: ['cost', 'category'] },
      sampleCols
    );
    if ('cost' in res.rows[0] || 'category' in res.rows[0]) {
      throw new Error('Dropped column still present in rows');
    }
    if (res.columns.some(c => c.name === 'cost' || c.name === 'category')) {
      throw new Error('Dropped column still present in metadata');
    }
  });

  test('DataCleaningEngine: DUPLICATE_COLUMN creates exact copy', () => {
    const res = DataCleaningEngine.duplicateColumn(
      sampleRows,
      { sourceColumn: 'full_name', newColumnName: 'name_backup' },
      sampleCols
    );
    if (res.rows[0].name_backup !== 'Alice Johnson') {
      throw new Error('Duplicate column value mismatch');
    }
    if (!res.columns.some(c => c.name === 'name_backup')) {
      throw new Error('Duplicate column missing from metadata');
    }
  });

  test('DataCleaningEngine: REORDER_COLUMNS reorders keys and schema', () => {
    const desiredOrder = ['order_date', 'id', 'full_name', 'revenue', 'cost', 'category'];
    const res = DataCleaningEngine.reorderColumns(
      sampleRows,
      { orderedColumns: desiredOrder },
      sampleCols
    );
    if (res.columns[0].name !== 'order_date') {
      throw new Error('First column is not order_date');
    }
    const rowKeys = Object.keys(res.rows[0]);
    if (rowKeys[0] !== 'order_date') {
      throw new Error('Row keys order not updated');
    }
  });

  test('DataCleaningEngine: SPLIT_COLUMN splits string into parts', () => {
    const res = DataCleaningEngine.splitColumn(
      sampleRows,
      {
        column: 'full_name',
        delimiter: ' ',
        newColumnNames: ['First_Name', 'Last_Name'],
        keepOriginal: true
      },
      sampleCols
    );
    if (res.rows[0].First_Name !== 'Alice' || res.rows[0].Last_Name !== 'Johnson') {
      throw new Error(`Split parts mismatch: ${res.rows[0].First_Name}, ${res.rows[0].Last_Name}`);
    }
    if (!('full_name' in res.rows[0])) {
      throw new Error('Expected original column to be kept');
    }
  });

  test('DataCleaningEngine: MERGE_COLUMNS concatenates fields with separator', () => {
    const res = DataCleaningEngine.mergeColumns(
      sampleRows,
      {
        columns: ['category', 'full_name'],
        delimiter: ' - ',
        newColumnName: 'Category_Customer',
        keepOriginal: true
      },
      sampleCols
    );
    if (res.rows[0].Category_Customer !== 'Tech - Alice Johnson') {
      throw new Error(`Merged string mismatch: ${res.rows[0].Category_Customer}`);
    }
  });

  test('DataCleaningEngine: EXTRACT_TEXT extracts prefix, suffix, and regex', () => {
    const res1 = DataCleaningEngine.extractText(
      sampleRows,
      {
        column: 'full_name',
        mode: 'prefix',
        delimiter: ' ',
        newColumnName: 'first_word'
      },
      sampleCols
    );
    if (res1.rows[0].first_word !== 'Alice') {
      throw new Error(`Prefix extract mismatch: ${res1.rows[0].first_word}`);
    }

    const res2 = DataCleaningEngine.extractText(
      sampleRows,
      {
        column: 'order_date',
        mode: 'regex',
        regexPattern: '^(\\d{4})',
        newColumnName: 'year_extracted'
      },
      sampleCols
    );
    if (res2.rows[0].year_extracted !== '2024') {
      throw new Error(`Regex extract mismatch: ${res2.rows[0].year_extracted}`);
    }
  });

  // =========================================================================
  // 3. CALCULATED & CONDITIONAL COLUMNS
  // =========================================================================

  test('DataCleaningEngine: CALCULATED_COLUMN computes profit and margin', () => {
    const res = DataCleaningEngine.calculatedColumn(
      sampleRows,
      {
        newColumnName: 'profit',
        expression: 'revenue - cost',
        resultType: 'numeric'
      },
      sampleCols
    );
    if (res.rows[0].profit !== 600) {
      throw new Error(`Calculated profit mismatch: expected 600, got ${res.rows[0].profit}`);
    }
    if (res.rows[2].profit !== 1000) {
      throw new Error(`Calculated profit mismatch row 3: expected 1000, got ${res.rows[2].profit}`);
    }
  });

  test('DataCleaningEngine: CONDITIONAL_COLUMN evaluates IF-THEN-ELSE rules', () => {
    const res = DataCleaningEngine.conditionalColumn(
      sampleRows,
      {
        newColumnName: 'deal_tier',
        rules: [
          {
            id: 'r1',
            logic: 'AND',
            conditions: [{ column: 'revenue', operator: 'greater_equal', value: '2000' }],
            thenValue: 'Tier 1 Platinum',
            thenType: 'string'
          },
          {
            id: 'r2',
            logic: 'AND',
            conditions: [{ column: 'revenue', operator: 'greater_equal', value: '1000' }],
            thenValue: 'Tier 2 Gold',
            thenType: 'string'
          }
        ],
        elseValue: 'Tier 3 Standard',
        elseType: 'string'
      },
      sampleCols
    );

    if (res.rows[0].deal_tier !== 'Tier 2 Gold') throw new Error(`Row 1 expected Gold, got ${res.rows[0].deal_tier}`);
    if (res.rows[1].deal_tier !== 'Tier 3 Standard') throw new Error(`Row 2 expected Standard, got ${res.rows[1].deal_tier}`);
    if (res.rows[2].deal_tier !== 'Tier 1 Platinum') throw new Error(`Row 3 expected Platinum, got ${res.rows[2].deal_tier}`);
  });

  // =========================================================================
  // 4. FILTERING, SORTING, AND RANKING
  // =========================================================================

  test('DataCleaningEngine: FILTER_ROWS with between and comparison filters', () => {
    const filtered = DataCleaningEngine.filterRows(sampleRows, {
      action: 'keep',
      logic: 'AND',
      conditions: [{ column: 'revenue', operator: 'between', value: '1000', value2: '2000' }]
    });
    if (filtered.length !== 2) {
      throw new Error(`Expected 2 rows in range [1000, 2000], got ${filtered.length}`);
    }
  });

  test('DataCleaningEngine: SORT_ROWS multi-level sorting', () => {
    const sorted = DataCleaningEngine.sortRows(sampleRows, {
      levels: [
        { column: 'category', direction: 'ASC', nulls: 'last' },
        { column: 'revenue', direction: 'DESC', nulls: 'last' }
      ]
    });
    if (sorted[0].category !== 'Furniture' || sorted[0].revenue !== 1100) {
      throw new Error(`Multi-sort mismatch: ${sorted[0].category}, ${sorted[0].revenue}`);
    }
    if (sorted[1].category !== 'Furniture' || sorted[1].revenue !== 800) {
      throw new Error(`Multi-sort row 2 mismatch: ${sorted[1].category}, ${sorted[1].revenue}`);
    }
  });

  test('DataCleaningEngine: RANK_ROWS calculates dense rank partitioned by category', () => {
    const res = DataCleaningEngine.rankRows(
      sampleRows,
      {
        measureColumn: 'revenue',
        targetColumnName: 'category_rank',
        direction: 'DESC',
        method: 'dense_rank',
        partitionBy: 'category'
      },
      sampleCols
    );

    const charlie = res.rows.find(r => r.full_name === 'Charlie Brown');
    const alice = res.rows.find(r => r.full_name === 'Alice Johnson');
    const diana = res.rows.find(r => r.full_name === 'Diana Prince');
    const bob = res.rows.find(r => r.full_name === 'Bob Smith');

    if (charlie?.category_rank !== 1) throw new Error(`Charlie rank should be 1, got ${charlie?.category_rank}`);
    if (alice?.category_rank !== 2) throw new Error(`Alice rank should be 2, got ${alice?.category_rank}`);
    if (diana?.category_rank !== 1) throw new Error(`Diana rank should be 1, got ${diana?.category_rank}`);
    if (bob?.category_rank !== 2) throw new Error(`Bob rank should be 2, got ${bob?.category_rank}`);
  });

  // =========================================================================
  // 5. DATE TRANSFORMS
  // =========================================================================

  test('DataCleaningEngine: DATE_EXTRACT extracts year, quarter, month_name, day', () => {
    const res1 = DataCleaningEngine.dateExtract(
      sampleRows,
      { column: 'order_date', targetColumnName: 'order_quarter', part: 'quarter' },
      sampleCols
    );
    if (res1.rows[0].order_quarter !== 1) throw new Error(`Quarter 1 mismatch, got ${res1.rows[0].order_quarter}`);
    if (res1.rows[1].order_quarter !== 2) throw new Error(`Quarter 2 mismatch, got ${res1.rows[1].order_quarter}`);

    const res2 = DataCleaningEngine.dateExtract(
      sampleRows,
      { column: 'order_date', targetColumnName: 'start_month', part: 'start_of_month' },
      sampleCols
    );
    if (res2.rows[0].start_month !== '2024-03-01') {
      throw new Error(`Start of month mismatch: ${res2.rows[0].start_month}`);
    }
  });

  test('DataCleaningEngine: DATE_DIFF computes duration between two dates', () => {
    const diffRows = [
      { start: '2024-01-01', end: '2024-01-11' },
      { start: '2024-01-01', end: '2024-07-01' }
    ];
    const res = DataCleaningEngine.dateDiff(
      diffRows,
      { startDateColumn: 'start', endDateColumn: 'end', targetColumnName: 'days_elapsed', unit: 'days' },
      [
        { name: 'start', dataType: 'date', isNullable: false, nullCount: 0, sampleValues: [] },
        { name: 'end', dataType: 'date', isNullable: false, nullCount: 0, sampleValues: [] }
      ]
    );
    if (res.rows[0].days_elapsed !== 10) {
      throw new Error(`Expected 10 days, got ${res.rows[0].days_elapsed}`);
    }
  });

  // =========================================================================
  // 6. PIVOT & UNPIVOT RESHAPING
  // =========================================================================

  test('DataCleaningEngine: PIVOT_TABLE aggregates categories into columns', () => {
    const salesData = [
      { Region: 'North', Product: 'Apples', Sales: 100 },
      { Region: 'North', Product: 'Oranges', Sales: 150 },
      { Region: 'South', Product: 'Apples', Sales: 200 },
      { Region: 'South', Product: 'Oranges', Sales: 250 }
    ];
    const cols: ColumnMetadata[] = [
      { name: 'Region', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: [] },
      { name: 'Product', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: [] },
      { name: 'Sales', dataType: 'numeric', isNullable: false, nullCount: 0, sampleValues: [] }
    ];

    const res = DataCleaningEngine.pivotTable(
      salesData,
      {
        rowColumns: ['Region'],
        pivotColumn: 'Product',
        valueColumn: 'Sales',
        aggregation: 'SUM'
      },
      cols
    );

    if (res.rows.length !== 2) throw new Error(`Expected 2 pivoted rows, got ${res.rows.length}`);
    const north = res.rows.find(r => r.Region === 'North');
    if (north?.Apples !== 100 || north?.Oranges !== 150) {
      throw new Error(`Pivoted values mismatch for North: Apples=${north?.Apples}, Oranges=${north?.Oranges}`);
    }
  });

  test('DataCleaningEngine: UNPIVOT_TABLE melts wide columns to attribute/value pairs', () => {
    const wideData = [
      { Country: 'US', Q1: 100, Q2: 120 },
      { Country: 'UK', Q1: 80, Q2: 90 }
    ];
    const cols: ColumnMetadata[] = [
      { name: 'Country', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: [] },
      { name: 'Q1', dataType: 'numeric', isNullable: false, nullCount: 0, sampleValues: [] },
      { name: 'Q2', dataType: 'numeric', isNullable: false, nullCount: 0, sampleValues: [] }
    ];

    const res = DataCleaningEngine.unpivotTable(
      wideData,
      {
        idColumns: ['Country'],
        valueColumns: ['Q1', 'Q2'],
        attributeColumnName: 'Quarter',
        valueColumnName: 'Revenue'
      },
      cols
    );

    if (res.rows.length !== 4) throw new Error(`Expected 4 melted rows, got ${res.rows.length}`);
    if (res.rows[0].Quarter !== 'Q1' || res.rows[0].Revenue !== 100) {
      throw new Error(`Unpivoted row 1 mismatch: ${JSON.stringify(res.rows[0])}`);
    }
  });

  // =========================================================================
  // 7. MULTI-STEP PIPELINE INTEGRATION
  // =========================================================================

  test('DataCleaningEngine: applyPipeline executes 15.2 transformations sequentially with diff tracking', () => {
    const steps: TransformStep[] = [
      {
        id: 's1',
        type: 'CALCULATED_COLUMN',
        description: 'Compute profit',
        params: { newColumnName: 'profit', expression: 'revenue - cost', resultType: 'numeric' },
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 's2',
        type: 'FILTER_ROWS',
        description: 'Keep revenue > 1000',
        params: {
          action: 'keep',
          logic: 'AND',
          conditions: [{ column: 'revenue', operator: 'greater_than', value: '1000' }]
        },
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 's3',
        type: 'SORT_ROWS',
        description: 'Sort by profit DESC',
        params: {
          levels: [{ column: 'profit', direction: 'DESC', nulls: 'last' }]
        },
        enabled: true,
        createdAt: new Date().toISOString()
      }
    ];

    const preview = DataCleaningEngine.applyPipeline(sampleRows, sampleCols, steps);
    if (preview.totalOriginalRows !== 4) throw new Error(`Original rows count mismatch: ${preview.totalOriginalRows}`);
    if (preview.totalCleanedRows !== 3) throw new Error(`Cleaned rows count mismatch: ${preview.totalCleanedRows}`);
    if (preview.cleanedRows[0].full_name !== 'Charlie Brown') {
      throw new Error(`Top row should be Charlie Brown with highest profit, got ${preview.cleanedRows[0].full_name}`);
    }
  });

  return results;
}
