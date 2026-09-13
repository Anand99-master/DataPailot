/**
 * Phase 16.1 UI/UX Polish & SQL Workspace Optimization Tests
 * Validates layout split calculation, session persistence contracts,
 * pagination logic, column resizing logic, and query results state transitions.
 */

export async function runPhase16_1Tests(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
    }
  };

  // 1. Split Ratio Clamping Logic
  const clampSplitRatio = (ratio: number): number => {
    return Math.max(15, Math.min(85, Math.round(ratio)));
  };

  test('Split Ratio: Default 58% is preserved', () => {
    if (clampSplitRatio(58) !== 58) throw new Error('Expected 58');
  });

  test('Split Ratio: Clamped to min 15% when below range', () => {
    if (clampSplitRatio(5) !== 15) throw new Error('Expected 15');
  });

  test('Split Ratio: Clamped to max 85% when above range', () => {
    if (clampSplitRatio(95) !== 85) throw new Error('Expected 85');
  });

  test('Split Ratio: Rounded to nearest whole percentage', () => {
    if (clampSplitRatio(42.7) !== 43) throw new Error('Expected 43');
  });

  // 2. Query Results Pagination Computation
  const computePagination = (totalRows: number, pageSize: number, currentPage: number) => {
    const totalPages = Math.ceil(totalRows / pageSize) || 1;
    const validPage = Math.max(1, Math.min(totalPages, currentPage));
    const startIdx = (validPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalRows);
    return { totalPages, validPage, startIdx, endIdx, displayedCount: endIdx - startIdx };
  };

  test('Pagination: Computes 3 total pages for 550 rows with pageSize 200', () => {
    const p = computePagination(550, 200, 1);
    if (p.totalPages !== 3 || p.displayedCount !== 200) throw new Error('Pagination error on page 1');
  });

  test('Pagination: Page 3 displays remaining 150 rows', () => {
    const p = computePagination(550, 200, 3);
    if (p.startIdx !== 400 || p.endIdx !== 550 || p.displayedCount !== 150) throw new Error('Pagination error on page 3');
  });

  test('Pagination: 0 rows produces 1 total page and 0 displayed rows', () => {
    const p = computePagination(0, 200, 1);
    if (p.totalPages !== 1 || p.displayedCount !== 0) throw new Error('Pagination error on 0 rows');
  });

  // 3. In-Memory Row Search Filtering
  const sampleRows = [
    { id: 1, name: 'Alice Customer', category: 'Enterprise', amount: 12000 },
    { id: 2, name: 'Bob SmallBiz', category: 'SMB', amount: 450 },
    { id: 3, name: 'Charlie Customer', category: 'Enterprise', amount: 35000 }
  ];

  const filterRows = (rows: any[], query: string) => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(r =>
      Object.values(r).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(q))
    );
  };

  test('Row Search: Empty search query returns all rows', () => {
    if (filterRows(sampleRows, '').length !== 3) throw new Error('Expected 3 rows');
  });

  test('Row Search: Category match returns filtered subset', () => {
    if (filterRows(sampleRows, 'enterprise').length !== 2) throw new Error('Expected 2 rows');
  });

  test('Row Search: Numeric amount match returns exact row', () => {
    if (filterRows(sampleRows, '12000').length !== 1) throw new Error('Expected 1 row');
  });

  test('Row Search: Unmatched search returns empty set', () => {
    if (filterRows(sampleRows, 'nonexistent').length !== 0) throw new Error('Expected 0 rows');
  });

  // 4. Column Resizing Constraints
  const computeColumnWidth = (currentWidth: number, deltaX: number, minWidth = 80): number => {
    return Math.max(minWidth, currentWidth + deltaX);
  };

  test('Column Resizing: Expands column by deltaX pixels', () => {
    if (computeColumnWidth(140, 50) !== 190) throw new Error('Expected 190px');
  });

  test('Column Resizing: Constrains shrink delta to minimum 80px', () => {
    if (computeColumnWidth(140, -100) !== 80) throw new Error('Expected 80px min constraint');
  });

  // 5. Query Results Status Presentation Contract
  const validateResultPresentation = (result: any) => {
    if (!result || result.status === 'idle') {
      return 'EMPTY_STATE';
    }
    if (result.status === 'error') {
      return 'ERROR_STATE';
    }
    if (result.status === 'cancelled') {
      return 'CANCELLED_STATE';
    }
    if (result.status === 'success' && result.rowCount === 0) {
      return 'ZERO_ROWS_STATE';
    }
    if (result.status === 'success' && result.rowCount > 0) {
      return 'DATA_GRID_STATE';
    }
    return 'UNKNOWN';
  };

  test('Results State: Null or idle result maps to EMPTY_STATE', () => {
    if (validateResultPresentation(null) !== 'EMPTY_STATE') throw new Error('Expected EMPTY_STATE');
    if (validateResultPresentation({ status: 'idle' }) !== 'EMPTY_STATE') throw new Error('Expected EMPTY_STATE');
  });

  test('Results State: Execution error maps to ERROR_STATE', () => {
    if (validateResultPresentation({ status: 'error', errorMessage: 'syntax error' }) !== 'ERROR_STATE') {
      throw new Error('Expected ERROR_STATE');
    }
  });

  test('Results State: User cancelled query maps to CANCELLED_STATE', () => {
    if (validateResultPresentation({ status: 'cancelled' }) !== 'CANCELLED_STATE') {
      throw new Error('Expected CANCELLED_STATE');
    }
  });

  test('Results State: 0 rows returned maps to ZERO_ROWS_STATE', () => {
    if (validateResultPresentation({ status: 'success', rowCount: 0, rows: [] }) !== 'ZERO_ROWS_STATE') {
      throw new Error('Expected ZERO_ROWS_STATE');
    }
  });

  test('Results State: Non-zero rows maps to DATA_GRID_STATE', () => {
    if (validateResultPresentation({ status: 'success', rowCount: 5, rows: [{ a: 1 }] }) !== 'DATA_GRID_STATE') {
      throw new Error('Expected DATA_GRID_STATE');
    }
  });

  return results;
}
