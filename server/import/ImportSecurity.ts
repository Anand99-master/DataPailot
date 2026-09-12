import path from 'path';
import fs from 'fs';

export class ImportSecurity {
  // 25 MB default limit
  public static readonly MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
  public static readonly MAX_PREVIEW_ROWS = 50;
  public static readonly MAX_IMPORT_ROWS = 100000;

  private static readonly ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls', '.json']);

  private static readonly ALLOWED_MIME_TYPES = new Set([
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json',
    'text/json',
    'application/octet-stream'
  ]);

  /**
   * Validates file size against configured limit
   */
  public static validateFileSize(sizeInBytes: number, maxBytes = ImportSecurity.MAX_FILE_SIZE_BYTES): { isValid: boolean; error?: string } {
    if (sizeInBytes <= 0) {
      return { isValid: false, error: 'Uploaded file is empty.' };
    }
    if (sizeInBytes > maxBytes) {
      const maxMb = Math.round(maxBytes / (1024 * 1024));
      return { isValid: false, error: `File size exceeds the maximum limit of ${maxMb}MB.` };
    }
    return { isValid: true };
  }

  /**
   * Validates file extension and extracts normalized file type
   */
  public static validateExtension(fileName: string): { isValid: boolean; extension?: string; fileType?: 'CSV' | 'XLSX' | 'JSON'; error?: string } {
    if (!fileName || typeof fileName !== 'string') {
      return { isValid: false, error: 'Missing or invalid file name.' };
    }

    // Path traversal check
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\') || fileName.includes('\0')) {
      return { isValid: false, error: 'Potential path traversal detected in file name.' };
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.has(ext)) {
      return {
        isValid: false,
        error: `Unsupported file type '${ext || 'unknown'}'. Only CSV, XLSX, and JSON files are supported.`
      };
    }

    let fileType: 'CSV' | 'XLSX' | 'JSON';
    if (ext === '.csv') fileType = 'CSV';
    else if (ext === '.xlsx' || ext === '.xls') fileType = 'XLSX';
    else fileType = 'JSON';

    return { isValid: true, extension: ext, fileType };
  }

  /**
   * Validates MIME type if provided
   */
  public static validateMimeType(mimeType?: string): { isValid: boolean; error?: string } {
    if (!mimeType) return { isValid: true }; // Optional MIME validation
    const normalized = mimeType.toLowerCase().split(';')[0].trim();
    if (!this.ALLOWED_MIME_TYPES.has(normalized)) {
      return {
        isValid: false,
        error: `Unsupported MIME type '${mimeType}'. Expected CSV, Excel, or JSON format.`
      };
    }
    return { isValid: true };
  }

  /**
   * Sanitizes user-provided file name to prevent filesystem/display exploits
   */
  public static sanitizeFileName(fileName: string): string {
    const base = path.basename(fileName);
    // Remove control characters, null bytes, and characters outside standard range
    const clean = base
      .replace(/[\x00-\x1f\x7f]/g, '')
      .replace(/[^\w.-]/g, '_')
      .replace(/_{2,}/g, '_');
    return clean || 'imported_dataset';
  }

  /**
   * Generates a safe SQL identifier for the table created in unified storage
   */
  public static toSafeSqlTableName(name: string): string {
    // Remove extension if present
    const withoutExt = name.replace(/\.[^/.]+$/, '');
    let clean = withoutExt
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[^a-z]+/, 'ds_')
      .replace(/_{2,}/g, '_')
      .slice(0, 48);

    if (!clean.startsWith('ds_') && !/^[a-z]/.test(clean)) {
      clean = `ds_${clean}`;
    }
    return clean || 'ds_imported_data';
  }

  /**
   * Sanitizes cell values to prevent CSV / Excel formula injection (CSV Injection / CWE-1236)
   * If a value begins with =, +, -, @, \t, or \r, prepend a single quote
   */
  public static sanitizeFormulaInjection(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Safely cleans up temporary files without throwing
   */
  public static safeUnlink(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}
