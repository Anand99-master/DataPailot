import * as XLSX from 'xlsx';
import { ColumnMetadata } from '../../src/types/import';
import { CsvParser } from './CsvParser';

export interface ParsedExcelResult {
  sheetNames: string[];
  selectedSheet: string;
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  totalRows: number;
  warnings: string[];
}

export class ExcelParser {
  /**
   * Inspects an Excel workbook buffer and returns available worksheet names
   */
  public static getSheetNames(buffer: Buffer): string[] {
    try {
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        bookSheets: true,
        cellFormula: false // Never evaluate or read formulas
      });
      return workbook.SheetNames || [];
    } catch (err: any) {
      throw new Error(`Failed to read Excel workbook: ${err.message}`);
    }
  }

  /**
   * Parses a selected worksheet from an Excel workbook buffer
   */
  public static parse(
    buffer: Buffer,
    options: {
      sheetName?: string;
      maxRows?: number;
      previewOnly?: boolean;
    } = {}
  ): ParsedExcelResult {
    const warnings: string[] = [];

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: true,    // Convert date cells to Date objects
        cellFormula: false,  // Do NOT execute formulas; treat cell values as data only
        cellHTML: false,
        cellText: false
      });
    } catch (err: any) {
      throw new Error(`Invalid or corrupted Excel file: ${err.message}`);
    }

    const sheetNames = workbook.SheetNames || [];
    if (sheetNames.length === 0) {
      throw new Error('Excel workbook contains no worksheets.');
    }

    const selectedSheet = options.sheetName && sheetNames.includes(options.sheetName)
      ? options.sheetName
      : sheetNames[0];

    const worksheet = workbook.Sheets[selectedSheet];
    if (!worksheet) {
      throw new Error(`Worksheet '${selectedSheet}' not found in workbook.`);
    }

    // Convert to 2D array of rows
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false
    });

    if (rawData.length === 0) {
      throw new Error(`Worksheet '${selectedSheet}' is empty.`);
    }

    // Row 0 as headers
    const rawHeaders = (rawData[0] || []) as unknown[];
    const rawRows = rawData.slice(1);

    // Sanitize and deduplicate column names
    const seenColNames = new Map<string, number>();
    const columnNames: string[] = rawHeaders.map((h, idx) => {
      let name = h !== null && h !== undefined ? String(h).trim() : '';
      if (!name) name = `column_${idx + 1}`;
      const lower = name.toLowerCase();
      const count = seenColNames.get(lower) || 0;
      seenColNames.set(lower, count + 1);
      return count > 0 ? `${name}_${count + 1}` : name;
    });

    const expectedCols = columnNames.length;
    const maxRows = options.maxRows || 100000;
    const limitedRows = rawRows.slice(0, maxRows);

    // Transform into row objects with data typing
    const rows: Record<string, unknown>[] = [];
    for (let rIdx = 0; rIdx < limitedRows.length; rIdx++) {
      const rowArr = (limitedRows[rIdx] || []) as unknown[];
      const rowObj: Record<string, unknown> = {};

      for (let cIdx = 0; cIdx < expectedCols; cIdx++) {
        const colName = columnNames[cIdx];
        const val = rowArr[cIdx];

        if (val === undefined || val === null) {
          rowObj[colName] = null;
        } else if (val instanceof Date) {
          // Format ISO date
          rowObj[colName] = val.toISOString().slice(0, 10);
        } else if (typeof val === 'number') {
          rowObj[colName] = val;
        } else if (typeof val === 'boolean') {
          rowObj[colName] = val;
        } else {
          // Coerce string
          const coerced = CsvParser.coerceValue(String(val));
          rowObj[colName] = coerced;
        }
      }
      rows.push(rowObj);
    }

    // Infer column metadata
    const columns: ColumnMetadata[] = columnNames.map(colName => {
      const values = rows.map(r => r[colName]);
      const dataType = CsvParser.inferColumnType(values);
      const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
      const nonNullSamples = Array.from(new Set(values.filter(v => v !== null && v !== undefined && v !== ''))).slice(0, 5);

      return {
        name: colName,
        dataType,
        isNullable: nullCount > 0,
        nullCount,
        sampleValues: nonNullSamples
      };
    });

    return {
      sheetNames,
      selectedSheet,
      columns,
      rows,
      totalRows: rawRows.length,
      warnings
    };
  }
}
