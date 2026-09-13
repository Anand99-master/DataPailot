import { ColumnMetadata } from '../../src/types/import';

export interface ParsedCsvResult {
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  totalRows: number;
  delimiter: string;
  hasHeader: boolean;
  warnings: string[];
}

export interface CsvChunkOptions {
  delimiter?: string;
  chunkSize?: number;
  maxRows?: number;
  previewOnly?: boolean;
  cancellationToken?: { isCancelled: () => boolean };
  onProgress?: (progress: { rowsProcessed: number; totalRows: number; percent: number }) => void;
}

export class CsvParser {
  /**
   * Fast row estimation by scanning newlines in text sample or whole file
   */
  public static estimateRowCount(csvText: string): number {
    if (!csvText) return 0;
    let count = 0;
    for (let i = 0; i < csvText.length; i++) {
      if (csvText.charCodeAt(i) === 10) { // '\n'
        count++;
      }
    }
    // If doesn't end with newline, add last line
    if (csvText.length > 0 && csvText.charCodeAt(csvText.length - 1) !== 10) {
      count++;
    }
    return Math.max(0, count - 1); // Subtract header line
  }

  /**
   * Auto-detects the delimiter by analyzing candidate delimiters on the first few non-empty lines
   */
  public static detectDelimiter(csvText: string): string {
    const candidates = [',', ';', '\t', '|'];
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 10);
    if (lines.length === 0) return ',';

    let bestDelimiter = ',';
    let maxConsistencyScore = -1;

    for (const d of candidates) {
      const counts = lines.map(line => {
        // Count delimiters outside quotes
        let count = 0;
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === d && !inQuotes) count++;
        }
        return count;
      });

      // Delimiter must appear at least once per line
      const minCount = Math.min(...counts);
      if (minCount > 0) {
        // Higher score if counts are consistent across lines
        const isUniform = counts.every(c => c === counts[0]);
        const score = (isUniform ? 1000 : 10) * counts[0];
        if (score > maxConsistencyScore) {
          maxConsistencyScore = score;
          bestDelimiter = d;
        }
      }
    }

    return bestDelimiter;
  }

  /**
   * Parses CSV string adhering to RFC 4180 with support for BOM, quotes, escaped quotes,
   * embedded commas, embedded newlines, empty values, and type inference.
   */
  public static parse(
    rawText: string,
    options: {
      delimiter?: string;
      chunkSize?: number;
      maxRows?: number;
      previewOnly?: boolean;
      cancellationToken?: { isCancelled: () => boolean };
      onProgress?: (progress: { rowsProcessed: number; totalRows: number; percent: number }) => void;
    } = {}
  ): ParsedCsvResult {
    const warnings: string[] = [];

    // Strip UTF-8 Byte Order Mark (BOM) if present
    let text = rawText;
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    if (!text.trim()) {
      throw new Error('CSV content is empty.');
    }

    const delimiter = options.delimiter || this.detectDelimiter(text);
    const rawTokens: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    const len = text.length;
    const maxRows = options.maxRows || 1000000;
    const isCancelled = () => options.cancellationToken?.isCancelled() || false;

    while (i < len) {
      if (i % 50000 === 0 && isCancelled()) {
        throw new Error('CSV parsing cancelled by user.');
      }

      const char = text[i];

      if (char === '"') {
        if (inQuotes && i + 1 < len && text[i + 1] === '"') {
          // Escaped quote: "" inside quoted string
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
          continue;
        }
      }

      if (!inQuotes) {
        if (char === delimiter) {
          currentRow.push(currentField);
          currentField = '';
          i++;
          continue;
        }

        if (char === '\r') {
          if (i + 1 < len && text[i + 1] === '\n') {
            i++; // skip \r in \r\n
          }
          currentRow.push(currentField);
          currentField = '';
          rawTokens.push(currentRow);
          currentRow = [];
          i++;
          if (options.previewOnly && rawTokens.length > (options.maxRows || 50) + 1) {
            break;
          }
          continue;
        }

        if (char === '\n') {
          currentRow.push(currentField);
          currentField = '';
          rawTokens.push(currentRow);
          currentRow = [];
          i++;
          if (options.previewOnly && rawTokens.length > (options.maxRows || 50) + 1) {
            break;
          }
          continue;
        }
      }

      currentField += char;
      i++;
    }

    // Push trailing field & row if present
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      rawTokens.push(currentRow);
    }

    if (inQuotes) {
      warnings.push('Unclosed quote detected at the end of the CSV file. Content was parsed up to the end.');
    }

    // Filter out completely blank rows
    const nonEmptyRows = rawTokens.filter(r => r.some(cell => cell.trim().length > 0));
    if (nonEmptyRows.length === 0) {
      throw new Error('CSV contains no data rows.');
    }

    // Header row
    const rawHeader = nonEmptyRows[0];
    const dataRows = nonEmptyRows.slice(1);

    // Sanitize and deduplicate column names
    const seenColNames = new Map<string, number>();
    const columnNames: string[] = rawHeader.map((h, idx) => {
      let col = h.trim();
      if (!col) col = `column_${idx + 1}`;
      const lower = col.toLowerCase();
      const count = seenColNames.get(lower) || 0;
      seenColNames.set(lower, count + 1);
      return count > 0 ? `${col}_${count + 1}` : col;
    });

    const expectedCols = columnNames.length;
    const limitedDataRows = dataRows.slice(0, maxRows);

    // Parse and type-infer rows
    const parsedRows: Record<string, unknown>[] = [];
    const totalDataCount = limitedDataRows.length;

    const progressInterval = (options as any).chunkSize || Math.min(2000, Math.max(500, Math.floor(totalDataCount / 10)));
    let lastReported = 0;

    if (options.onProgress) {
      options.onProgress({
        rowsProcessed: 0,
        totalRows: totalDataCount,
        percent: 0
      });
    }

    for (let rIdx = 0; rIdx < totalDataCount; rIdx++) {
      if (rIdx % 500 === 0 && isCancelled()) {
        break;
      }

      const rowTokens = limitedDataRows[rIdx];
      const rowObj: Record<string, unknown> = {};

      if (rowTokens.length !== expectedCols) {
        if (warnings.length < 5) {
          warnings.push(`Row ${rIdx + 2} has ${rowTokens.length} columns (expected ${expectedCols}). Missing columns were padded with null.`);
        }
      }

      for (let cIdx = 0; cIdx < expectedCols; cIdx++) {
        const colName = columnNames[cIdx];
        const rawVal = rowTokens[cIdx];
        rowObj[colName] = this.coerceValue(rawVal);
      }
      parsedRows.push(rowObj);

      if (options.onProgress && (rIdx - lastReported >= progressInterval || rIdx === totalDataCount - 1)) {
        lastReported = rIdx;
        options.onProgress({
          rowsProcessed: rIdx + 1,
          totalRows: totalDataCount,
          percent: Math.min(Math.round(((rIdx + 1) / totalDataCount) * 100), 100)
        });
      }
    }

    // Infer column metadata and types on a sample (or full if small) to maintain sub-second performance on 500k rows
    const sampleSize = Math.min(parsedRows.length, 5000);
    const sampleSlice = parsedRows.slice(0, sampleSize);

    const columns: ColumnMetadata[] = columnNames.map(colName => {
      const sampleValues = sampleSlice.map(r => r[colName]);
      const dataType = this.inferColumnType(sampleValues);
      
      let nullCount = 0;
      const nonNullSamples: unknown[] = [];
      const distinctSet = new Set<unknown>();

      for (let sIdx = 0; sIdx < sampleValues.length; sIdx++) {
        const v = sampleValues[sIdx];
        if (v === null || v === undefined || v === '') {
          nullCount++;
        } else {
          distinctSet.add(v);
        }
      }

      const estimatedNulls = sampleSize > 0 && sampleSize < parsedRows.length
        ? Math.round((nullCount / sampleSize) * parsedRows.length)
        : nullCount;

      const nonNullArray = Array.from(distinctSet).slice(0, 5);

      return {
        name: colName,
        dataType,
        isNullable: estimatedNulls > 0,
        nullCount: estimatedNulls,
        sampleValues: nonNullArray
      };
    });

    return {
      columns,
      rows: parsedRows,
      totalRows: dataRows.length,
      delimiter,
      hasHeader: true,
      warnings
    };
  }

  /**
   * Coerces a raw string cell value into an appropriate JavaScript primitive
   */
  public static coerceValue(raw: string | undefined): unknown {
    if (raw === undefined || raw === null) return null;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'none') {
      return null;
    }

    // Boolean check
    const lower = trimmed.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;

    // Fast check for number (must not be an ambiguous date string like '2023-01-01')
    const firstCode = trimmed.charCodeAt(0);
    const isNumStart = (firstCode >= 48 && firstCode <= 57) || firstCode === 45 || firstCode === 43 || firstCode === 46; // 0-9, -, +, .

    if (isNumStart) {
      if (!trimmed.includes('-') && !trimmed.includes('/') && !trimmed.includes(':')) {
        const num = Number(trimmed);
        if (!isNaN(num) && isFinite(num)) {
          return num;
        }
      }

      // Negative numbers or exponents
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
        const num = Number(trimmed);
        if (!isNaN(num) && isFinite(num)) {
          return num;
        }
      }

      // Date check
      if (this.isDateString(trimmed)) {
        return trimmed;
      }
    }

    return trimmed;
  }

  /**
   * Evaluates whether a string matches common date or timestamp formats
   */
  public static isDateString(val: string): boolean {
    if (!val || val.length < 8 || val.length > 35) return false;
    const isIsoDate = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(val);
    const isSlashDate = /^\d{1,4}[/-]\d{1,2}[/-]\d{2,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(val);
    if (!isIsoDate && !isSlashDate) return false;

    const parsed = Date.parse(val);
    return !isNaN(parsed);
  }

  /**
   * Infers overall column type from sample values
   */
  public static inferColumnType(values: unknown[]): ColumnMetadata['dataType'] {
    const nonNulls = values.filter(v => v !== null && v !== undefined && v !== '');
    if (nonNulls.length === 0) return 'text';

    let integerCount = 0;
    let numericCount = 0;
    let booleanCount = 0;
    let dateCount = 0;

    for (let i = 0; i < nonNulls.length; i++) {
      const v = nonNulls[i];
      if (typeof v === 'boolean') {
        booleanCount++;
      } else if (typeof v === 'number') {
        numericCount++;
        if (Number.isInteger(v)) {
          integerCount++;
        }
      } else if (typeof v === 'string') {
        const lower = v.toLowerCase();
        if (lower === 'true' || lower === 'false') {
          booleanCount++;
        } else if (/^-?\d+$/.test(v)) {
          integerCount++;
          numericCount++;
        } else if (/^-?\d*\.\d+$/.test(v)) {
          numericCount++;
        } else if (this.isDateString(v)) {
          dateCount++;
        }
      }
    }

    const total = nonNulls.length;
    const threshold = 0.85; // 85% uniformity threshold

    if (booleanCount / total >= threshold) return 'boolean';
    if (dateCount / total >= threshold) return 'date';
    if (integerCount / total >= threshold) return 'integer';
    if (numericCount / total >= threshold) return 'numeric';

    return 'text';
  }
}
