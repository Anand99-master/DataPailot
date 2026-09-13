import {
  TransformStep,
  CleaningPreviewResult,
  CellChange,
  RemoveMissingParams,
  FillMissingParams,
  RemoveDuplicatesParams,
  ConvertTypeParams,
  StandardizeDateParams,
  TextCleanParams,
  NumericCleanParams,
  MapValuesParams,
  HandleOutliersParams,
  RenameColumnParams,
  DropColumnParams,
  DuplicateColumnParams,
  ReorderColumnsParams,
  SplitColumnParams,
  MergeColumnsParams,
  ExtractTextParams,
  CalculatedColumnParams,
  ConditionalColumnParams,
  FilterRowsParams,
  SortRowsParams,
  RankRowsParams,
  DateExtractParams,
  DateDiffParams,
  PivotParams,
  UnpivotParams
} from '../types/cleaning';
import { ColumnMetadata } from '../types/import';
import { ExpressionEngine } from './expressionEngine';

export class DataCleaningEngine {
  /**
   * Helper to determine if a value is logically missing (null, undefined, '', or whitespace-only)
   */
  public static isMissing(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') {
      return value.trim() === '';
    }
    return false;
  }

  /**
   * Deep clone array of row objects
   */
  public static cloneRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.map(r => ({ ...r }));
  }

  /**
   * 1. Remove Missing Values
   */
  public static removeMissing(
    rows: Record<string, unknown>[],
    params: RemoveMissingParams,
    allColumns: string[]
  ): Record<string, unknown>[] {
    const targetCols = params.columns && params.columns.length > 0 ? params.columns : allColumns;
    const strategy = params.strategy || 'any';

    return rows.filter(row => {
      if (strategy === 'all') {
        const allMissing = targetCols.every(col => this.isMissing(row[col]));
        return !allMissing;
      } else {
        const anyMissing = targetCols.some(col => this.isMissing(row[col]));
        return !anyMissing;
      }
    });
  }

  /**
   * 2. Fill Missing Values
   */
  public static fillMissing(
    rows: Record<string, unknown>[],
    params: FillMissingParams
  ): Record<string, unknown>[] {
    const { column, strategy, customValue } = params;
    if (!column) return rows;

    const cloned = this.cloneRows(rows);
    let replacement: unknown = customValue;

    if (strategy === 'zero') {
      replacement = 0;
    } else if (strategy === 'mean' || strategy === 'median' || strategy === 'mode') {
      const nonNulls = cloned
        .map(r => r[column])
        .filter(v => !this.isMissing(v));

      if (strategy === 'mode') {
        const counts = new Map<unknown, number>();
        let maxCount = 0;
        let modeVal: unknown = '';
        for (const v of nonNulls) {
          const c = (counts.get(v) || 0) + 1;
          counts.set(v, c);
          if (c > maxCount) {
            maxCount = c;
            modeVal = v;
          }
        }
        replacement = modeVal;
      } else {
        const nums = nonNulls
          .map(v => (typeof v === 'number' ? v : Number(v)))
          .filter(n => !isNaN(n) && isFinite(n));

        if (nums.length > 0) {
          if (strategy === 'mean') {
            const sum = nums.reduce((a, b) => a + b, 0);
            replacement = Math.round((sum / nums.length) * 100) / 100;
          } else if (strategy === 'median') {
            nums.sort((a, b) => a - b);
            const mid = Math.floor(nums.length / 2);
            replacement = nums.length % 2 !== 0
              ? nums[mid]
              : Math.round(((nums[mid - 1] + nums[mid]) / 2) * 100) / 100;
          }
        } else {
          replacement = 0;
        }
      }
    }

    if (strategy === 'ffill') {
      let lastKnown: unknown = null;
      for (let i = 0; i < cloned.length; i++) {
        if (!this.isMissing(cloned[i][column])) {
          lastKnown = cloned[i][column];
        } else if (lastKnown !== null) {
          cloned[i][column] = lastKnown;
        }
      }
      return cloned;
    }

    if (strategy === 'bfill') {
      let nextKnown: unknown = null;
      for (let i = cloned.length - 1; i >= 0; i--) {
        if (!this.isMissing(cloned[i][column])) {
          nextKnown = cloned[i][column];
        } else if (nextKnown !== null) {
          cloned[i][column] = nextKnown;
        }
      }
      return cloned;
    }

    for (const row of cloned) {
      if (this.isMissing(row[column])) {
        row[column] = replacement;
      }
    }

    return cloned;
  }

  /**
   * 3. Remove Duplicate Rows
   */
  public static removeDuplicates(
    rows: Record<string, unknown>[],
    params: RemoveDuplicatesParams,
    allColumns: string[]
  ): Record<string, unknown>[] {
    const targetCols = params.columns && params.columns.length > 0 ? params.columns : allColumns;
    const keep = params.keep || 'first';

    const seen = new Map<string, Record<string, unknown>>();
    const orderedKeys: string[] = [];

    const rowList = keep === 'last' ? [...rows].reverse() : rows;

    for (const row of rowList) {
      const key = targetCols.map(c => String(row[c] ?? '__NULL__')).join('|~|');
      if (!seen.has(key)) {
        seen.set(key, row);
        orderedKeys.push(key);
      }
    }

    if (keep === 'last') {
      orderedKeys.reverse();
    }

    return orderedKeys.map(k => seen.get(k)!);
  }

  /**
   * 4. Convert Column Data Type
   */
  public static convertType(
    rows: Record<string, unknown>[],
    params: ConvertTypeParams,
    invalidCollector?: { rowIndex: number; column: string; rawValue: unknown; reason: string }[]
  ): Record<string, unknown>[] {
    const { column, targetType, onInvalid } = params;
    if (!column) return rows;

    const cloned = this.cloneRows(rows);

    cloned.forEach((row, idx) => {
      const val = row[column];
      if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
        row[column] = null;
        return;
      }

      if (targetType === 'text') {
        row[column] = String(val);
        return;
      }

      if (targetType === 'integer') {
        const cleanStr = String(val).replace(/,/g, '').trim();
        const num = parseInt(cleanStr, 10);
        if (isNaN(num)) {
          if (invalidCollector) {
            invalidCollector.push({
              rowIndex: idx,
              column,
              rawValue: val,
              reason: `Cannot convert "${val}" to Integer`
            });
          }
          row[column] = onInvalid === 'null' ? null : val;
        } else {
          row[column] = num;
        }
        return;
      }

      if (targetType === 'numeric') {
        const cleanStr = String(val).replace(/[\$,€,£,¥,%]/g, '').replace(/,/g, '').trim();
        const num = parseFloat(cleanStr);
        if (isNaN(num)) {
          if (invalidCollector) {
            invalidCollector.push({
              rowIndex: idx,
              column,
              rawValue: val,
              reason: `Cannot convert "${val}" to Numeric`
            });
          }
          row[column] = onInvalid === 'null' ? null : val;
        } else {
          row[column] = num;
        }
        return;
      }

      if (targetType === 'boolean') {
        const str = String(val).toLowerCase().trim();
        if (['true', '1', 'yes', 'y', 't'].includes(str)) {
          row[column] = true;
        } else if (['false', '0', 'no', 'n', 'f'].includes(str)) {
          row[column] = false;
        } else {
          if (invalidCollector) {
            invalidCollector.push({
              rowIndex: idx,
              column,
              rawValue: val,
              reason: `Cannot convert "${val}" to Boolean`
            });
          }
          row[column] = onInvalid === 'null' ? null : val;
        }
        return;
      }

      if (targetType === 'date') {
        const parsed = new Date(String(val));
        if (isNaN(parsed.getTime())) {
          if (invalidCollector) {
            invalidCollector.push({
              rowIndex: idx,
              column,
              rawValue: val,
              reason: `Cannot parse "${val}" as valid Date`
            });
          }
          row[column] = onInvalid === 'null' ? null : val;
        } else {
          row[column] = parsed.toISOString().split('T')[0];
        }
        return;
      }
    });

    return cloned;
  }

  /**
   * 5. Standardize Date Format
   */
  public static standardizeDate(
    rows: Record<string, unknown>[],
    params: StandardizeDateParams,
    invalidCollector?: { rowIndex: number; column: string; rawValue: unknown; reason: string }[]
  ): Record<string, unknown>[] {
    const { column, targetFormat } = params;
    if (!column) return rows;

    const cloned = this.cloneRows(rows);

    cloned.forEach((row, idx) => {
      const val = row[column];
      if (this.isMissing(val)) {
        row[column] = null;
        return;
      }

      const str = String(val).trim();
      let d: Date | null = null;

      // Handle common formats e.g. DD/MM/YYYY or MM/DD/YYYY or YYYY-MM-DD
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(str)) {
        const parts = str.split(/[\/\-\.]/);
        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);

        if (p1 > 12 && p2 <= 12) {
          d = new Date(y, p2 - 1, p1);
        } else {
          d = new Date(y, p1 - 1, p2);
        }
      } else {
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) {
          d = parsed;
        }
      }

      if (!d || isNaN(d.getTime())) {
        if (invalidCollector) {
          invalidCollector.push({
            rowIndex: idx,
            column,
            rawValue: val,
            reason: `Invalid date format for standardization: "${val}"`
          });
        }
        return;
      }

      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');

      switch (targetFormat) {
        case 'YYYY-MM-DD':
          row[column] = `${yyyy}-${mm}-${dd}`;
          break;
        case 'YYYY/MM/DD':
          row[column] = `${yyyy}/${mm}/${dd}`;
          break;
        case 'DD/MM/YYYY':
          row[column] = `${dd}/${mm}/${yyyy}`;
          break;
        case 'MM/DD/YYYY':
          row[column] = `${mm}/${dd}/${yyyy}`;
          break;
        case 'ISO':
          row[column] = d.toISOString();
          break;
        default:
          row[column] = `${yyyy}-${mm}-${dd}`;
      }
    });

    return cloned;
  }

  /**
   * 6. Text Cleaning
   */
  public static textClean(
    rows: Record<string, unknown>[],
    params: TextCleanParams
  ): Record<string, unknown>[] {
    const { column, trim, collapseSpaces, caseTransform, findReplace, standardizeValues } = params;
    if (!column) return rows;

    const cloned = this.cloneRows(rows);

    cloned.forEach(row => {
      let val = row[column];
      if (val === null || val === undefined) return;
      let str = String(val);

      if (trim) {
        str = str.trim();
      }
      if (collapseSpaces) {
        str = str.replace(/\s+/g, ' ');
      }
      if (caseTransform === 'upper') {
        str = str.toUpperCase();
      } else if (caseTransform === 'lower') {
        str = str.toLowerCase();
      } else if (caseTransform === 'title') {
        str = str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      }

      if (findReplace && findReplace.length > 0) {
        for (const fr of findReplace) {
          if (!fr.find) continue;
          const flags = fr.matchCase ? 'g' : 'gi';
          const safeFind = fr.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          str = str.replace(new RegExp(safeFind, flags), fr.replace || '');
        }
      }

      if (standardizeValues && standardizeValues.length > 0) {
        for (const sv of standardizeValues) {
          if (sv.from.some(f => f.trim().toLowerCase() === str.trim().toLowerCase())) {
            str = sv.to;
            break;
          }
        }
      }

      row[column] = str;
    });

    return cloned;
  }

  /**
   * 7. Numeric & Currency Cleaning
   */
  public static numericClean(
    rows: Record<string, unknown>[],
    params: NumericCleanParams
  ): Record<string, unknown>[] {
    const { column, removeCommas, removeCurrency, removePercentage, handleNegative } = params;
    if (!column) return rows;

    const cloned = this.cloneRows(rows);

    cloned.forEach(row => {
      const val = row[column];
      if (this.isMissing(val)) return;

      let str = String(val);

      if (removeCurrency) {
        str = str.replace(/[\$,€,£,¥,₹,₩,CHF,CAD,AUD]/gi, '');
      }
      if (removeCommas) {
        str = str.replace(/,/g, '');
      }
      if (removePercentage) {
        str = str.replace(/%/g, '');
      }

      str = str.trim();

      // Handle accounting negative format: (123.45) -> -123.45
      if (str.startsWith('(') && str.endsWith(')')) {
        str = '-' + str.slice(1, -1).trim();
      }

      let num = parseFloat(str);
      if (!isNaN(num)) {
        if (num < 0) {
          if (handleNegative === 'abs') num = Math.abs(num);
          else if (handleNegative === 'zero') num = 0;
          else if (handleNegative === 'null') {
            row[column] = null;
            return;
          }
        }
        row[column] = num;
      }
    });

    return cloned;
  }

  /**
   * 8. Value Mapping
   */
  public static mapValues(
    rows: Record<string, unknown>[],
    params: MapValuesParams
  ): Record<string, unknown>[] {
    const { column, mappings } = params;
    if (!column || !mappings || mappings.length === 0) return rows;

    const map = new Map<string, string | null>();
    mappings.forEach(m => {
      map.set(String(m.from).toLowerCase().trim(), m.to);
    });

    const cloned = this.cloneRows(rows);
    cloned.forEach(row => {
      const val = row[column];
      if (val !== null && val !== undefined) {
        const key = String(val).toLowerCase().trim();
        if (map.has(key)) {
          row[column] = map.get(key);
        }
      }
    });

    return cloned;
  }

  /**
   * 9. Handle Outliers
   */
  public static handleOutliers(
    rows: Record<string, unknown>[],
    params: HandleOutliersParams
  ): Record<string, unknown>[] {
    const { column, method, action } = params;
    const threshold = params.threshold || (method === 'iqr' ? 1.5 : 3.0);
    if (!column) return rows;

    const nums = rows
      .map(r => Number(r[column]))
      .filter(n => !isNaN(n) && isFinite(n));

    if (nums.length < 4) return rows;

    let lowerBound = -Infinity;
    let upperBound = Infinity;

    if (method === 'iqr') {
      nums.sort((a, b) => a - b);
      const q25 = nums[Math.floor(nums.length * 0.25)];
      const q75 = nums[Math.floor(nums.length * 0.75)];
      const iqr = q75 - q25;
      lowerBound = q25 - threshold * iqr;
      upperBound = q75 + threshold * iqr;
    } else {
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / nums.length;
      const variance = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nums.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        lowerBound = mean - threshold * stdDev;
        upperBound = mean + threshold * stdDev;
      }
    }

    if (action === 'remove') {
      return rows.filter(row => {
        const v = Number(row[column]);
        if (isNaN(v)) return true;
        return v >= lowerBound && v <= upperBound;
      });
    } else {
      const cloned = this.cloneRows(rows);
      cloned.forEach(row => {
        const v = Number(row[column]);
        if (!isNaN(v)) {
          if (v < lowerBound) row[column] = lowerBound;
          else if (v > upperBound) row[column] = upperBound;
        }
      });
      return cloned;
    }
  }

  // =========================================================================
  // 15.2 ADVANCED DATA TRANSFORMATIONS
  // =========================================================================

  /**
   * 10. Rename Column
   */
  public static renameColumn(
    rows: Record<string, unknown>[],
    params: RenameColumnParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { oldName, newName } = params;
    if (!oldName || !newName || oldName === newName) return { rows, columns };

    const cloned = rows.map(r => {
      const newRow: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (k === oldName) {
          newRow[newName] = v;
        } else {
          newRow[k] = v;
        }
      }
      return newRow;
    });

    const updatedCols = columns.map(c => (c.name === oldName ? { ...c, name: newName } : c));
    return { rows: cloned, columns: updatedCols };
  }

  /**
   * 11. Drop Columns
   */
  public static dropColumn(
    rows: Record<string, unknown>[],
    params: DropColumnParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const dropSet = new Set(params.columns || []);
    if (dropSet.size === 0) return { rows, columns };

    const cloned = rows.map(r => {
      const newRow: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (!dropSet.has(k)) {
          newRow[k] = v;
        }
      }
      return newRow;
    });

    const updatedCols = columns.filter(c => !dropSet.has(c.name));
    return { rows: cloned, columns: updatedCols };
  }

  /**
   * Parse flexible date helper
   */
  public static parseFlexibleDate(str: string): Date | null {
    if (!str || typeof str !== 'string') return null;
    const trimmed = str.trim();
    if (!trimmed) return null;

    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(trimmed)) {
      const parts = trimmed.split(/[\/\-\.]/);
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (p1 > 12 && p2 <= 12) {
        const d = new Date(y, p2 - 1, p1);
        return isNaN(d.getTime()) ? null : d;
      } else {
        const d = new Date(y, p1 - 1, p2);
        return isNaN(d.getTime()) ? null : d;
      }
    }

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Format date helper
   */
  public static formatDate(d: Date, targetFormat: 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO'): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');

    switch (targetFormat) {
      case 'YYYY-MM-DD':
        return `${yyyy}-${mm}-${dd}`;
      case 'YYYY/MM/DD':
        return `${yyyy}/${mm}/${dd}`;
      case 'DD/MM/YYYY':
        return `${dd}/${mm}/${yyyy}`;
      case 'MM/DD/YYYY':
        return `${mm}/${dd}/${yyyy}`;
      case 'ISO':
        return d.toISOString();
      default:
        return `${yyyy}-${mm}-${dd}`;
    }
  }

  /**
   * 12. Duplicate Column
   */
  public static duplicateColumn(
    rows: Record<string, unknown>[],
    params: DuplicateColumnParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { sourceColumn, newColumnName } = params;
    if (!sourceColumn || !newColumnName) return { rows, columns };

    const cloned = rows.map(r => ({
      ...r,
      [newColumnName]: r[sourceColumn]
    }));

    const sourceMeta = columns.find(c => c.name === sourceColumn);
    const newCol: ColumnMetadata = {
      name: newColumnName,
      dataType: sourceMeta?.dataType || 'text',
      isNullable: true,
      nullCount: 0,
      sampleValues: []
    };

    return { rows: cloned, columns: [...columns, newCol] };
  }

  /**
   * 13. Reorder Columns
   */
  public static reorderColumns(
    rows: Record<string, unknown>[],
    params: ReorderColumnsParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { orderedColumns } = params;
    if (!orderedColumns || orderedColumns.length === 0) return { rows, columns };

    const orderMap = new Map<string, number>();
    orderedColumns.forEach((col, idx) => orderMap.set(col, idx));

    const updatedCols = [...columns].sort((a, b) => {
      const idxA = orderMap.has(a.name) ? orderMap.get(a.name)! : 999;
      const idxB = orderMap.has(b.name) ? orderMap.get(b.name)! : 999;
      return idxA - idxB;
    });

    const cloned = rows.map(r => {
      const newRow: Record<string, unknown> = {};
      for (const col of updatedCols) {
        newRow[col.name] = r[col.name];
      }
      return newRow;
    });

    return { rows: cloned, columns: updatedCols };
  }

  /**
   * 14. Split Column
   */
  public static splitColumn(
    rows: Record<string, unknown>[],
    params: SplitColumnParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { column, delimiter, maxSplits, newColumnNames, keepOriginal } = params;
    if (!column || !newColumnNames || newColumnNames.length === 0) return { rows, columns };

    const delim = delimiter || ' ';
    const count = newColumnNames.length;

    const cloned = rows.map(r => {
      const val = r[column];
      const str = val === null || val === undefined ? '' : String(val);
      const parts = str.split(delim, maxSplits || count);

      const newRow: Record<string, unknown> = { ...r };
      for (let i = 0; i < count; i++) {
        const colName = newColumnNames[i];
        newRow[colName] = parts[i] !== undefined ? parts[i].trim() : null;
      }

      if (!keepOriginal && count > 0) {
        delete newRow[column];
      }

      return newRow;
    });

    let updatedCols = [...columns];
    if (!keepOriginal) {
      updatedCols = updatedCols.filter(c => c.name !== column);
    }
    for (const name of newColumnNames) {
      if (!updatedCols.some(c => c.name === name)) {
        updatedCols.push({ name, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
      }
    }

    return { rows: cloned, columns: updatedCols };
  }

  /**
   * 15. Merge Columns
   */
  public static mergeColumns(
    rows: Record<string, unknown>[],
    params: MergeColumnsParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { columns: targetCols, delimiter, newColumnName, keepOriginal } = params;
    if (!targetCols || targetCols.length === 0 || !newColumnName) return { rows, columns };

    const delim = delimiter ?? ' ';

    const cloned = rows.map(r => {
      const mergedVal = targetCols
        .map(c => (r[c] === null || r[c] === undefined ? '' : String(r[c])))
        .filter(s => s.length > 0)
        .join(delim);

      const newRow: Record<string, unknown> = { ...r, [newColumnName]: mergedVal };

      if (!keepOriginal) {
        for (const col of targetCols) {
          if (col !== newColumnName) delete newRow[col];
        }
      }

      return newRow;
    });

    let updatedCols = [...columns];
    if (!keepOriginal) {
      const dropSet = new Set(targetCols);
      updatedCols = updatedCols.filter(c => !dropSet.has(c.name));
    }
    if (!updatedCols.some(c => c.name === newColumnName)) {
      updatedCols.push({ name: newColumnName, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
    }

    return { rows: cloned, columns: updatedCols };
  }

  /**
   * 16. Extract Text (Substring, Prefix, Suffix, Regex)
   */
  public static extractText(
    rows: Record<string, unknown>[],
    params: ExtractTextParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { column, mode, start, length, delimiter, count, regexPattern, newColumnName, replaceOriginal } = params;
    const targetCol = replaceOriginal ? column : newColumnName || `${column}_extracted`;

    const cloned = rows.map(r => {
      const raw = r[column];
      if (raw === null || raw === undefined) {
        return replaceOriginal ? { ...r, [targetCol]: null } : { ...r, [targetCol]: null };
      }

      const str = String(raw);
      let extracted: string | null = null;

      if (mode === 'substring') {
        const s = Math.max(0, start || 0);
        extracted = length ? str.substring(s, s + length) : str.substring(s);
      } else if (mode === 'prefix') {
        if (delimiter) {
          const idx = str.indexOf(delimiter);
          extracted = idx !== -1 ? str.substring(0, idx) : str;
        } else {
          extracted = str.substring(0, count || 5);
        }
      } else if (mode === 'suffix') {
        if (delimiter) {
          const idx = str.lastIndexOf(delimiter);
          extracted = idx !== -1 ? str.substring(idx + delimiter.length) : str;
        } else {
          const n = count || 5;
          extracted = str.slice(-n);
        }
      } else if (mode === 'regex') {
        try {
          const match = str.match(new RegExp(regexPattern || '.*'));
          extracted = match ? (match[1] !== undefined ? match[1] : match[0]) : null;
        } catch {
          extracted = null;
        }
      }

      return {
        ...r,
        [targetCol]: extracted
      };
    });

    let updatedCols = [...columns];
    if (!replaceOriginal && !updatedCols.some(c => c.name === targetCol)) {
      updatedCols.push({ name: targetCol, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
    }

    return { rows: cloned, columns: updatedCols };
  }

  /**
   * 17. Calculated Column (Safe Expression Evaluator)
   */
  public static calculatedColumn(
    rows: Record<string, unknown>[],
    params: CalculatedColumnParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { newColumnName, expression, resultType } = params;
    if (!newColumnName || !expression) return { rows, columns };

    const ast = ExpressionEngine.parse(expression);

    const cloned = rows.map(r => {
      const val = ExpressionEngine.evaluate(ast, r);
      return {
        ...r,
        [newColumnName]: val
      };
    });

    let inferredType: 'numeric' | 'text' | 'boolean' = resultType || 'numeric';
    if (!resultType && cloned.length > 0) {
      const sample = cloned.find(r => r[newColumnName] !== null && r[newColumnName] !== undefined)?.[newColumnName];
      if (typeof sample === 'boolean') inferredType = 'boolean';
      else if (typeof sample === 'string') inferredType = 'text';
      else inferredType = 'numeric';
    }

    const updatedCols = [...columns];
    const existingIdx = updatedCols.findIndex(c => c.name === newColumnName);
    if (existingIdx !== -1) {
      updatedCols[existingIdx] = { ...updatedCols[existingIdx], dataType: inferredType };
    } else {
      updatedCols.push({ name: newColumnName, dataType: inferredType, isNullable: true, nullCount: 0, sampleValues: [] });
    }

    return { rows: cloned, columns: updatedCols };
  }

  /**
   * 18. Conditional Column (Rule Builder: IF - THEN - ELSE)
   */
  public static conditionalColumn(
    rows: Record<string, unknown>[],
    params: ConditionalColumnParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { newColumnName, rules, elseValue, elseType } = params;
    if (!newColumnName || !rules || rules.length === 0) return { rows, columns };

    const castVal = (val: unknown, type?: string) => {
      if (val === null || val === undefined) return null;
      if (type === 'number') {
        const n = Number(val);
        return isNaN(n) ? null : n;
      }
      if (type === 'boolean') {
        return Boolean(val);
      }
      return String(val);
    };

    const cloned = rows.map(r => {
      let matchedValue: unknown = undefined;

      for (const rule of rules) {
        const condResults = rule.conditions.map(c => {
          const rowVal = r[c.column];
          if (c.operator === 'is_null') return rowVal === null || rowVal === undefined || rowVal === '';
          if (c.operator === 'is_not_null') return rowVal !== null && rowVal !== undefined && rowVal !== '';

          if (rowVal === null || rowVal === undefined) return false;

          const n1 = typeof rowVal === 'number' ? rowVal : Number(rowVal);
          const n2 = typeof c.value === 'number' ? c.value : Number(c.value);
          const isNum = !isNaN(n1) && !isNaN(n2) && c.value !== '' && c.value !== undefined;

          const s1 = String(rowVal).toLowerCase();
          const s2 = String(c.value ?? '').toLowerCase();

          switch (c.operator) {
            case 'equals':
              return isNum ? n1 === n2 : s1 === s2;
            case 'not_equals':
              return isNum ? n1 !== n2 : s1 !== s2;
            case 'greater_than':
              return isNum ? n1 > n2 : s1 > s2;
            case 'less_than':
              return isNum ? n1 < n2 : s1 < s2;
            case 'greater_equal':
              return isNum ? n1 >= n2 : s1 >= s2;
            case 'less_equal':
              return isNum ? n1 <= n2 : s1 <= s2;
            case 'contains':
              return s1.includes(s2);
            case 'not_contains':
              return !s1.includes(s2);
            case 'starts_with':
              return s1.startsWith(s2);
            case 'ends_with':
              return s1.endsWith(s2);
            default:
              return false;
          }
        });

        const isMatch =
          rule.logic === 'OR'
            ? condResults.some(Boolean)
            : condResults.every(Boolean);

        if (isMatch) {
          matchedValue = castVal(rule.thenValue, rule.thenType);
          break;
        }
      }

      if (matchedValue === undefined) {
        matchedValue = castVal(elseValue, elseType);
      }

      return {
        ...r,
        [newColumnName]: matchedValue
      };
    });

    const updatedCols = [...columns];
    if (!updatedCols.some(c => c.name === newColumnName)) {
      updatedCols.push({ name: newColumnName, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
    }

    return { rows: cloned, columns: updatedCols };
  }

  /**
   * 19. Filter Rows (Multi-condition keep / remove)
   */
  public static filterRows(
    rows: Record<string, unknown>[],
    params: FilterRowsParams
  ): Record<string, unknown>[] {
    const { action, logic, conditions } = params;
    if (!conditions || conditions.length === 0) return rows;

    return rows.filter(row => {
      const matchResults = conditions.map(c => {
        const rowVal = row[c.column];
        if (c.operator === 'is_null') return rowVal === null || rowVal === undefined || rowVal === '';
        if (c.operator === 'is_not_null') return rowVal !== null && rowVal !== undefined && rowVal !== '';

        if (rowVal === null || rowVal === undefined) return false;

        const n1 = typeof rowVal === 'number' ? rowVal : Number(rowVal);
        const n2 = typeof c.value === 'number' ? c.value : Number(c.value);
        const isNum = !isNaN(n1) && !isNaN(n2) && c.value !== '' && c.value !== undefined;

        const s1 = String(rowVal).toLowerCase();
        const s2 = String(c.value ?? '').toLowerCase();

        switch (c.operator) {
          case 'equals':
            return isNum ? n1 === n2 : s1 === s2;
          case 'not_equals':
            return isNum ? n1 !== n2 : s1 !== s2;
          case 'greater_than':
            return isNum ? n1 > n2 : s1 > s2;
          case 'less_than':
            return isNum ? n1 < n2 : s1 < s2;
          case 'greater_equal':
            return isNum ? n1 >= n2 : s1 >= s2;
          case 'less_equal':
            return isNum ? n1 <= n2 : s1 <= s2;
          case 'contains':
            return s1.includes(s2);
          case 'starts_with':
            return s1.startsWith(s2);
          case 'ends_with':
            return s1.endsWith(s2);
          case 'between': {
            const min = Number(c.value);
            const max = Number(c.value2);
            return !isNaN(n1) && !isNaN(min) && !isNaN(max) && n1 >= min && n1 <= max;
          }
          case 'in_list': {
            const list = c.valueList || String(c.value || '').split(',').map(s => s.trim().toLowerCase());
            return list.includes(s1);
          }
          default:
            return true;
        }
      });

      const matched =
        logic === 'OR'
          ? matchResults.some(Boolean)
          : matchResults.every(Boolean);

      return action === 'remove' ? !matched : matched;
    });
  }

  /**
   * 20. Sort Rows (Multi-Column Sorting)
   */
  public static sortRows(
    rows: Record<string, unknown>[],
    params: SortRowsParams
  ): Record<string, unknown>[] {
    const { levels } = params;
    if (!levels || levels.length === 0) return rows;

    const cloned = [...rows];

    cloned.sort((a, b) => {
      for (const level of levels) {
        const col = level.column;
        const dir = level.direction === 'DESC' ? -1 : 1;
        const nulls = level.nulls || 'last';

        const valA = a[col];
        const valB = b[col];

        const isNullA = valA === null || valA === undefined || valA === '';
        const isNullB = valB === null || valB === undefined || valB === '';

        if (isNullA && isNullB) continue;
        if (isNullA) return nulls === 'first' ? -1 : 1;
        if (isNullB) return nulls === 'first' ? 1 : -1;

        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return (numA - numB) * dir;
        } else {
          const cmp = String(valA).localeCompare(String(valB));
          if (cmp !== 0) return cmp * dir;
        }
      }
      return 0;
    });

    return cloned;
  }

  /**
   * 21. Rank Rows (Grouped / Windowed Ranking)
   */
  public static rankRows(
    rows: Record<string, unknown>[],
    params: RankRowsParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { measureColumn, targetColumnName, direction, method, partitionBy } = params;
    if (!measureColumn || !targetColumnName) return { rows, columns };

    const dir = direction === 'DESC' ? -1 : 1;

    // Attach original row index to maintain row identity
    interface IndexedRow {
      idx: number;
      row: Record<string, unknown>;
    }
    const indexed: IndexedRow[] = rows.map((row, idx) => ({ idx, row: { ...row } }));

    // Partition logic
    const partitions = new Map<string, IndexedRow[]>();
    for (const item of indexed) {
      const partKey = partitionBy ? String(item.row[partitionBy] ?? '__ALL__') : '__ALL__';
      if (!partitions.has(partKey)) partitions.set(partKey, []);
      partitions.get(partKey)!.push(item);
    }

    for (const [, group] of partitions) {
      group.sort((a, b) => {
        const valA = a.row[measureColumn];
        const valB = b.row[measureColumn];
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return (numA - numB) * dir;
        }
        return String(valA ?? '').localeCompare(String(valB ?? '')) * dir;
      });

      let currentRank = 1;
      let denseRank = 1;

      for (let i = 0; i < group.length; i++) {
        const item = group[i];
        if (i > 0) {
          const prevVal = group[i - 1].row[measureColumn];
          const curVal = item.row[measureColumn];
          const isSame = prevVal === curVal || (Number(prevVal) === Number(curVal) && !isNaN(Number(curVal)));
          if (!isSame) {
            denseRank++;
            currentRank = i + 1;
          }
        }

        if (method === 'row_number') {
          item.row[targetColumnName] = i + 1;
        } else if (method === 'dense_rank') {
          item.row[targetColumnName] = denseRank;
        } else if (method === 'percentile') {
          item.row[targetColumnName] = group.length > 1
            ? Math.round(((i) / (group.length - 1)) * 100 * 100) / 100
            : 100;
        } else {
          // Standard rank
          item.row[targetColumnName] = currentRank;
        }
      }
    }

    // Restore original index order
    indexed.sort((a, b) => a.idx - b.idx);
    const resultRows = indexed.map(i => i.row);

    const updatedCols = [...columns];
    if (!updatedCols.some(c => c.name === targetColumnName)) {
      updatedCols.push({ name: targetColumnName, dataType: 'integer', isNullable: true, nullCount: 0, sampleValues: [] });
    }

    return { rows: resultRows, columns: updatedCols };
  }

  /**
   * 22. Date Extract (Year, Quarter, Month, Week, Day, etc.)
   */
  public static dateExtract(
    rows: Record<string, unknown>[],
    params: DateExtractParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { column, targetColumnName, part } = params;
    if (!column || !targetColumnName || !part) return { rows, columns };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const cloned = rows.map(r => {
      const val = r[column];
      if (val === null || val === undefined || val === '') {
        return { ...r, [targetColumnName]: null };
      }

      const d = new Date(String(val));
      if (isNaN(d.getTime())) {
        return { ...r, [targetColumnName]: null };
      }

      let extracted: unknown = null;
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth(); // 0-11
      const day = d.getUTCDate(); // 1-31
      const dayOfWeek = d.getUTCDay(); // 0-6 (0=Sun)

      switch (part) {
        case 'year':
          extracted = y;
          break;
        case 'quarter':
          extracted = Math.floor(m / 3) + 1;
          break;
        case 'month_num':
          extracted = m + 1;
          break;
        case 'month_name':
          extracted = monthNames[m];
          break;
        case 'week': {
          const startOfYear = new Date(Date.UTC(y, 0, 1));
          const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000));
          extracted = Math.ceil((days + startOfYear.getUTCDay() + 1) / 7);
          break;
        }
        case 'day':
          extracted = day;
          break;
        case 'day_name':
          extracted = dayNames[dayOfWeek];
          break;
        case 'day_of_week':
          extracted = dayOfWeek === 0 ? 7 : dayOfWeek; // 1 = Monday, 7 = Sunday
          break;
        case 'start_of_month':
          extracted = `${y}-${String(m + 1).padStart(2, '0')}-01`;
          break;
        case 'end_of_month': {
          const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
          extracted = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          break;
        }
        case 'start_of_quarter': {
          const qMonth = Math.floor(m / 3) * 3 + 1;
          extracted = `${y}-${String(qMonth).padStart(2, '0')}-01`;
          break;
        }
        case 'end_of_quarter': {
          const endQMonth = Math.floor(m / 3) * 3 + 3;
          const lastQDay = new Date(Date.UTC(y, endQMonth, 0)).getUTCDate();
          extracted = `${y}-${String(endQMonth).padStart(2, '0')}-${String(lastQDay).padStart(2, '0')}`;
          break;
        }
      }

      return {
        ...r,
        [targetColumnName]: extracted
      };
    });

    const isNumericPart = ['year', 'quarter', 'month_num', 'week', 'day', 'day_of_week'].includes(part);
    const updatedCols = [...columns];
    if (!updatedCols.some(c => c.name === targetColumnName)) {
      updatedCols.push({
        name: targetColumnName,
        dataType: isNumericPart ? 'integer' : 'text',
        isNullable: true,
        nullCount: 0,
        sampleValues: []
      });
    }

    return { rows: cloned, columns: updatedCols };
  }

  /**
   * 23. Date Diff (Days, Months, Years between two dates)
   */
  public static dateDiff(
    rows: Record<string, unknown>[],
    params: DateDiffParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { startDateColumn, endDateColumn, targetColumnName, unit } = params;
    if (!startDateColumn || !endDateColumn || !targetColumnName) return { rows, columns };

    const cloned = rows.map(r => {
      const d1 = new Date(String(r[startDateColumn]));
      const d2 = new Date(String(r[endDateColumn]));

      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        return { ...r, [targetColumnName]: null };
      }

      const msDiff = d2.getTime() - d1.getTime();
      let diff: number = 0;

      if (unit === 'days') {
        diff = Math.round(msDiff / (1000 * 60 * 60 * 24));
      } else if (unit === 'months') {
        const yearDiff = d2.getUTCFullYear() - d1.getUTCFullYear();
        diff = yearDiff * 12 + (d2.getUTCMonth() - d1.getUTCMonth());
      } else if (unit === 'years') {
        diff = d2.getUTCFullYear() - d1.getUTCFullYear();
      }

      return {
        ...r,
        [targetColumnName]: diff
      };
    });

    const updatedCols = [...columns];
    if (!updatedCols.some(c => c.name === targetColumnName)) {
      updatedCols.push({ name: targetColumnName, dataType: 'numeric', isNullable: true, nullCount: 0, sampleValues: [] });
    }

    return { rows: cloned, columns: updatedCols };
  }

  /**
   * 24. Pivot Table
   */
  public static pivotTable(
    rows: Record<string, unknown>[],
    params: PivotParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { rowColumns, pivotColumn, valueColumn, aggregation } = params;
    if (!rowColumns || rowColumns.length === 0 || !pivotColumn || !valueColumn) {
      return { rows, columns };
    }

    // Collect distinct pivot column values
    const pivotValuesSet = new Set<string>();
    for (const r of rows) {
      const v = r[pivotColumn];
      if (v !== null && v !== undefined && v !== '') {
        pivotValuesSet.add(String(v));
      }
    }
    const pivotValues = Array.from(pivotValuesSet).sort();

    // Group rows by rowColumns
    const groups = new Map<string, { keyRecord: Record<string, unknown>; cells: Map<string, number[]> }>();

    for (const r of rows) {
      const groupKey = rowColumns.map(c => String(r[c] ?? '')).join('|~|');
      if (!groups.has(groupKey)) {
        const keyRec: Record<string, unknown> = {};
        rowColumns.forEach(c => (keyRec[c] = r[c]));
        groups.set(groupKey, { keyRecord: keyRec, cells: new Map() });
      }

      const group = groups.get(groupKey)!;
      const pVal = String(r[pivotColumn] ?? '');
      const numVal = Number(r[valueColumn]);

      if (pVal && !isNaN(numVal)) {
        if (!group.cells.has(pVal)) group.cells.set(pVal, []);
        group.cells.get(pVal)!.push(numVal);
      }
    }

    const pivotedRows: Record<string, unknown>[] = [];

    for (const [, group] of groups) {
      const rowObj: Record<string, unknown> = { ...group.keyRecord };

      for (const pVal of pivotValues) {
        const nums = group.cells.get(pVal) || [];
        if (nums.length === 0) {
          rowObj[pVal] = aggregation === 'COUNT' ? 0 : null;
          continue;
        }

        switch (aggregation) {
          case 'SUM':
            rowObj[pVal] = Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
            break;
          case 'COUNT':
            rowObj[pVal] = nums.length;
            break;
          case 'AVG':
            rowObj[pVal] = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
            break;
          case 'MIN':
            rowObj[pVal] = Math.min(...nums);
            break;
          case 'MAX':
            rowObj[pVal] = Math.max(...nums);
            break;
        }
      }

      pivotedRows.push(rowObj);
    }

    // Reconstruct column metadata
    const newColumns: ColumnMetadata[] = [];
    for (const cName of rowColumns) {
      const orig = columns.find(c => c.name === cName);
      newColumns.push(orig || { name: cName, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
    }
    for (const pVal of pivotValues) {
      newColumns.push({
        name: pVal,
        dataType: aggregation === 'COUNT' ? 'integer' : 'numeric',
        isNullable: true,
        nullCount: 0,
        sampleValues: []
      });
    }

    return { rows: pivotedRows, columns: newColumns };
  }

  /**
   * 25. Unpivot / Melt Table
   */
  public static unpivotTable(
    rows: Record<string, unknown>[],
    params: UnpivotParams,
    columns: ColumnMetadata[]
  ): { rows: Record<string, unknown>[]; columns: ColumnMetadata[] } {
    const { idColumns, valueColumns, attributeColumnName, valueColumnName } = params;
    if (!idColumns || !valueColumns || valueColumns.length === 0 || !attributeColumnName || !valueColumnName) {
      return { rows, columns };
    }

    const unpivotedRows: Record<string, unknown>[] = [];

    for (const r of rows) {
      for (const valCol of valueColumns) {
        const newRow: Record<string, unknown> = {};
        for (const idCol of idColumns) {
          newRow[idCol] = r[idCol];
        }
        newRow[attributeColumnName] = valCol;
        newRow[valueColumnName] = r[valCol] ?? null;
        unpivotedRows.push(newRow);
      }
    }

    const newColumns: ColumnMetadata[] = [];
    for (const idCol of idColumns) {
      const orig = columns.find(c => c.name === idCol);
      newColumns.push(orig || { name: idCol, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
    }
    newColumns.push({ name: attributeColumnName, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
    newColumns.push({ name: valueColumnName, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });

    return { rows: unpivotedRows, columns: newColumns };
  }

  /**
   * Complete Pipeline Execution with full diff & cell change tracking
   */
  public static applyPipeline(
    originalRows: Record<string, unknown>[],
    columns: ColumnMetadata[],
    steps: TransformStep[]
  ): CleaningPreviewResult {
    const startTime = Date.now();
    const originalColNames = columns.map(c => c.name);
    let currentRows = this.cloneRows(originalRows);
    let currentColumns = columns.map(c => ({ ...c }));

    const invalidConversions: { rowIndex: number; column: string; rawValue: unknown; reason: string }[] = [];
    const activeSteps = steps.filter(s => s.enabled);

    for (const step of activeSteps) {
      const allColNames = currentColumns.map(c => c.name);

      switch (step.type) {
        case 'REMOVE_MISSING':
          currentRows = this.removeMissing(currentRows, step.params, allColNames);
          break;
        case 'FILL_MISSING':
          currentRows = this.fillMissing(currentRows, step.params);
          break;
        case 'REMOVE_DUPLICATES':
          currentRows = this.removeDuplicates(currentRows, step.params, allColNames);
          break;
        case 'CONVERT_TYPE':
          currentRows = this.convertType(currentRows, step.params, invalidConversions);
          currentColumns = currentColumns.map(c =>
            c.name === step.params.column ? { ...c, dataType: step.params.targetType } : c
          );
          break;
        case 'STANDARDIZE_DATE':
          currentRows = this.standardizeDate(currentRows, step.params, invalidConversions);
          break;
        case 'TEXT_CLEAN':
          currentRows = this.textClean(currentRows, step.params);
          break;
        case 'NUMERIC_CLEAN':
          currentRows = this.numericClean(currentRows, step.params);
          break;
        case 'MAP_VALUES':
          currentRows = this.mapValues(currentRows, step.params);
          break;
        case 'HANDLE_OUTLIERS':
          currentRows = this.handleOutliers(currentRows, step.params);
          break;
        case 'RENAME_COLUMN': {
          const res = this.renameColumn(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'DROP_COLUMN': {
          const res = this.dropColumn(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'DUPLICATE_COLUMN': {
          const res = this.duplicateColumn(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'REORDER_COLUMNS': {
          const res = this.reorderColumns(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'SPLIT_COLUMN': {
          const res = this.splitColumn(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'MERGE_COLUMNS': {
          const res = this.mergeColumns(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'EXTRACT_TEXT': {
          const res = this.extractText(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'CALCULATED_COLUMN': {
          const res = this.calculatedColumn(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'CONDITIONAL_COLUMN': {
          const res = this.conditionalColumn(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'FILTER_ROWS': {
          currentRows = this.filterRows(currentRows, step.params);
          break;
        }
        case 'SORT_ROWS': {
          currentRows = this.sortRows(currentRows, step.params);
          break;
        }
        case 'RANK_ROWS': {
          const res = this.rankRows(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'DATE_EXTRACT': {
          const res = this.dateExtract(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'DATE_DIFF': {
          const res = this.dateDiff(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'PIVOT_TABLE': {
          const res = this.pivotTable(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
        case 'UNPIVOT_TABLE': {
          const res = this.unpivotTable(currentRows, step.params, currentColumns);
          currentRows = res.rows;
          currentColumns = res.columns;
          break;
        }
      }
    }

    // Compute cell changes for common columns
    const changedCells: CellChange[] = [];
    const affectedRowsSet = new Set<number>();
    const affectedColsSet = new Set<string>();

    const commonCols = originalColNames.filter(c => currentColumns.some(cc => cc.name === c));
    const minLength = Math.min(originalRows.length, currentRows.length);

    for (let r = 0; r < minLength; r++) {
      const orig = originalRows[r];
      const cln = currentRows[r];
      for (const col of commonCols) {
        const v1 = orig[col];
        const v2 = cln[col];
        if (v1 !== v2 && JSON.stringify(v1) !== JSON.stringify(v2)) {
          changedCells.push({
            rowIndex: r,
            column: col,
            original: v1,
            cleaned: v2
          });
          affectedRowsSet.add(r);
          affectedColsSet.add(col);
        }
      }
    }

    const rowDiff = Math.abs(originalRows.length - currentRows.length);
    const colDiff = Math.abs(columns.length - currentColumns.length);
    const totalAffectedRows = affectedRowsSet.size + rowDiff;

    return {
      originalRows,
      cleanedRows: currentRows,
      columns: currentColumns,
      totalOriginalRows: originalRows.length,
      totalCleanedRows: currentRows.length,
      affectedRowCount: totalAffectedRows,
      affectedColumnCount: affectedColsSet.size + colDiff,
      changedCells,
      invalidConversions,
      executionTimeMs: Date.now() - startTime
    };
  }
}
