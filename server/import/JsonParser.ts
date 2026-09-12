import { ColumnMetadata } from '../../src/types/import';
import { CsvParser } from './CsvParser';

export interface ParsedJsonResult {
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  totalRows: number;
  warnings: string[];
}

export class JsonParser {
  /**
   * Parses and validates a JSON string representing a tabular dataset
   */
  public static parse(
    jsonText: string,
    options: {
      maxRows?: number;
      previewOnly?: boolean;
    } = {}
  ): ParsedJsonResult {
    const warnings: string[] = [];

    if (!jsonText || !jsonText.trim()) {
      throw new Error('JSON content is empty.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err: any) {
      // Try parsing as Newline-Delimited JSON (NDJSON / JSON Lines)
      const lines = jsonText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        try {
          parsed = lines.map(line => JSON.parse(line));
        } catch {
          throw new Error(`Invalid JSON syntax: ${err.message}`);
        }
      } else {
        throw new Error(`Invalid JSON syntax: ${err.message}`);
      }
    }

    // Support single object by wrapping in array
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsed = [parsed];
    }

    // Require array structure
    if (!Array.isArray(parsed)) {
      throw new Error(
        'JSON dataset must be an array of objects representing tabular rows (e.g. [{"id": 1, "name": "A"}]).'
      );
    }

    if (parsed.length === 0) {
      throw new Error('JSON array is empty. Please provide an array containing at least one object.');
    }

    // Check that elements are objects, not primitives or arrays
    for (let i = 0; i < Math.min(parsed.length, 20); i++) {
      const item = parsed[i];
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(
          `Row ${i + 1} is not a valid object. JSON dataset elements must be objects representing tabular records.`
        );
      }
    }

    // Discover union of all column keys across objects
    const seenColKeys = new Set<string>();
    const columnKeys: string[] = [];

    const maxRows = options.maxRows || 100000;
    const itemsToScan = options.previewOnly ? parsed.slice(0, 100) : parsed.slice(0, 1000);

    for (const item of itemsToScan) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const key of Object.keys(item)) {
          if (!seenColKeys.has(key)) {
            seenColKeys.add(key);
            columnKeys.push(key);
          }
        }
      }
    }

    if (columnKeys.length === 0) {
      throw new Error('No column properties found in JSON objects.');
    }

    // Process and normalize rows
    const dataSlice = parsed.slice(0, maxRows);
    const rows: Record<string, unknown>[] = [];

    for (let rIdx = 0; rIdx < dataSlice.length; rIdx++) {
      const item = dataSlice[rIdx];
      const rowObj: Record<string, unknown> = {};

      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        warnings.push(`Skipped non-object item at row ${rIdx + 1}.`);
        continue;
      }

      for (const col of columnKeys) {
        const rawVal = (item as Record<string, unknown>)[col];

        if (rawVal === undefined || rawVal === null) {
          rowObj[col] = null;
        } else if (typeof rawVal === 'object') {
          // Flatten or stringify nested structures
          warnings.push(`Row ${rIdx + 1} column '${col}' contains a nested object/array. It has been serialized to string.`);
          rowObj[col] = JSON.stringify(rawVal);
        } else if (typeof rawVal === 'string') {
          rowObj[col] = CsvParser.coerceValue(rawVal);
        } else {
          rowObj[col] = rawVal;
        }
      }
      rows.push(rowObj);
    }

    // Infer column types
    const columns: ColumnMetadata[] = columnKeys.map(colName => {
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
      columns,
      rows,
      totalRows: parsed.length,
      warnings
    };
  }
}
