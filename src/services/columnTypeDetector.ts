import { QueryResultColumn } from '../types/database';
import { DetectedColumn, ColumnSemanticType } from '../types/visualization';

export class ColumnTypeDetector {
  /**
   * Introspects query columns and actual rows to detect precise semantic types
   */
  public static detect(
    columns: QueryResultColumn[],
    rows: Record<string, unknown>[]
  ): DetectedColumn[] {
    return columns.map(col => this.detectSingleColumn(col, rows));
  }

  private static detectSingleColumn(
    col: QueryResultColumn,
    rows: Record<string, unknown>[]
  ): DetectedColumn {
    const rawType = (col.dataType || '').toLowerCase().trim();
    const colName = col.name;

    // Collect non-null values
    const nonNullValues: unknown[] = [];
    let nullCount = 0;
    const distinctSet = new Set<unknown>();

    for (const row of rows) {
      const val = row[colName];
      if (val === null || val === undefined) {
        nullCount++;
      } else {
        nonNullValues.push(val);
        distinctSet.add(val);
      }
    }

    const totalRows = rows.length;
    const isNullable = nullCount > 0;
    const distinctCount = distinctSet.size;
    const sampleValues = nonNullValues.slice(0, 5);

    // Initial deduction from DB dataType
    let semanticType = this.deduceFromDbType(rawType);

    // If unknown or generic, inspect actual values
    if (semanticType === 'unknown' || semanticType === 'text') {
      semanticType = this.deduceFromValues(nonNullValues, semanticType);
    }

    const isNumeric = semanticType === 'integer' || semanticType === 'numeric';
    const isDateOrTime = semanticType === 'date' || semanticType === 'timestamp';
    const isBoolean = semanticType === 'boolean';
    const isCategorical = !isNumeric && !isDateOrTime;

    // Compute min / max if values exist
    let min: number | string | null = null;
    let max: number | string | null = null;

    if (nonNullValues.length > 0) {
      if (isNumeric) {
        const numValues = nonNullValues
          .map(v => (typeof v === 'number' ? v : parseFloat(String(v))))
          .filter(v => !isNaN(v));
        if (numValues.length > 0) {
          min = Math.min(...numValues);
          max = Math.max(...numValues);
        }
      } else if (isDateOrTime) {
        const dateValues = nonNullValues
          .map(v => (v instanceof Date ? v.getTime() : Date.parse(String(v))))
          .filter(v => !isNaN(v));
        if (dateValues.length > 0) {
          min = new Date(Math.min(...dateValues)).toISOString();
          max = new Date(Math.max(...dateValues)).toISOString();
        }
      } else {
        const strValues = nonNullValues.map(v => String(v));
        strValues.sort();
        min = strValues[0];
        max = strValues[strValues.length - 1];
      }
    }

    return {
      name: colName,
      dataType: col.dataType || 'text',
      semanticType,
      isNumeric,
      isDateOrTime,
      isCategorical,
      isBoolean,
      isNullable,
      distinctCount,
      nullCount,
      sampleValues,
      min,
      max
    };
  }

  private static deduceFromDbType(dbType: string): ColumnSemanticType {
    if (!dbType) return 'unknown';

    // Integers
    if (
      dbType.includes('int') ||
      dbType === 'serial' ||
      dbType === 'bigserial' ||
      dbType === 'smallint'
    ) {
      return 'integer';
    }

    // Decimals / Floats / Numeric
    if (
      dbType.includes('numeric') ||
      dbType.includes('decimal') ||
      dbType.includes('float') ||
      dbType.includes('real') ||
      dbType.includes('double') ||
      dbType.includes('money')
    ) {
      return 'numeric';
    }

    // Boolean
    if (dbType.includes('bool')) {
      return 'boolean';
    }

    // Timestamp
    if (dbType.includes('timestamp') || dbType.includes('time')) {
      return 'timestamp';
    }

    // Date
    if (dbType === 'date') {
      return 'date';
    }

    // Categorical / Text
    if (
      dbType.includes('char') ||
      dbType.includes('text') ||
      dbType.includes('json') ||
      dbType.includes('uuid') ||
      dbType === 'name'
    ) {
      return 'text';
    }

    return 'unknown';
  }

  private static deduceFromValues(
    values: unknown[],
    fallback: ColumnSemanticType
  ): ColumnSemanticType {
    if (values.length === 0) return fallback;

    let intCount = 0;
    let floatCount = 0;
    let dateCount = 0;
    let boolCount = 0;
    const testSample = values.slice(0, 30);

    for (const val of testSample) {
      if (typeof val === 'boolean') {
        boolCount++;
        continue;
      }
      if (typeof val === 'number') {
        if (Number.isInteger(val)) intCount++;
        else floatCount++;
        continue;
      }

      const str = String(val).trim();
      if (str === 'true' || str === 'false') {
        boolCount++;
        continue;
      }

      // Check numeric
      if (/^-?\d+$/.test(str)) {
        intCount++;
        continue;
      }
      if (/^-?\d+(\.\d+)?$/.test(str)) {
        floatCount++;
        continue;
      }

      // Check ISO / SQL date
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const parsed = Date.parse(str);
        if (!isNaN(parsed)) {
          if (str.includes('T') || str.includes(':')) {
            dateCount++;
          } else {
            dateCount++;
          }
          continue;
        }
      }
    }

    const total = testSample.length;
    const threshold = 0.8;

    if (boolCount / total >= threshold) return 'boolean';
    if (intCount / total >= threshold) return 'integer';
    if ((intCount + floatCount) / total >= threshold) return 'numeric';
    if (dateCount / total >= threshold) return 'timestamp';

    return 'text';
  }
}
