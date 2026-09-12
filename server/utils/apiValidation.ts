export class ApiValidation {
  private static readonly IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_$]{0,127}$/;

  /**
   * Validates SQL query input
   */
  public static validateSql(sql: unknown): { isValid: boolean; error?: string; cleanSql?: string } {
    if (typeof sql !== 'string') {
      return { isValid: false, error: 'SQL query must be a string' };
    }
    const trimmed = sql.trim();
    if (!trimmed) {
      return { isValid: false, error: 'SQL query cannot be empty' };
    }
    if (trimmed.length > 100000) {
      return { isValid: false, error: 'SQL query exceeds maximum permitted length (100,000 characters)' };
    }
    if (/\0/.test(trimmed)) {
      return { isValid: false, error: 'SQL query contains invalid null byte character' };
    }
    return { isValid: true, cleanSql: trimmed };
  }

  /**
   * Validates schema or table identifier
   */
  public static validateIdentifier(
    name: unknown,
    fieldName = 'Identifier'
  ): { isValid: boolean; error?: string; cleanName?: string } {
    if (typeof name !== 'string') {
      return { isValid: false, error: `${fieldName} must be a string` };
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return { isValid: false, error: `${fieldName} cannot be empty` };
    }
    if (trimmed.length > 128) {
      return { isValid: false, error: `${fieldName} exceeds maximum length of 128 characters` };
    }
    // Allow standard postgres unquoted identifiers: letters, digits, underscore, dollar
    if (!this.IDENTIFIER_REGEX.test(trimmed)) {
      return {
        isValid: false,
        error: `${fieldName} contains invalid characters. Only alphanumeric characters and underscores are allowed.`
      };
    }
    return { isValid: true, cleanName: trimmed };
  }

  /**
   * Validates and bounds query execution limits
   */
  public static sanitizeQueryLimits(
    maxRows?: unknown,
    timeoutMs?: unknown
  ): { maxRows: number; timeoutMs: number } {
    let rows = 1000;
    if (typeof maxRows === 'number' && !isNaN(maxRows) && maxRows > 0) {
      rows = Math.min(Math.max(1, Math.floor(maxRows)), 10000);
    }

    let timeout = 15000;
    if (typeof timeoutMs === 'number' && !isNaN(timeoutMs) && timeoutMs > 0) {
      timeout = Math.min(Math.max(1000, Math.floor(timeoutMs)), 60000);
    }

    return { maxRows: rows, timeoutMs: timeout };
  }
}
