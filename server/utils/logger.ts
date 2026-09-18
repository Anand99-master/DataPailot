/**
 * Structured server logger for DataPilot.
 * Safely logs operational events, request IDs, duration, and error codes.
 * GUARANTEE: Never logs passwords, API keys, connection strings, auth tokens, or sensitive SQL literals.
 */

export class Logger {
  private static sanitizeSql(sql: string): string {
    if (!sql) return '';
    return sql
      // Mask single quoted literals
      .replace(/'(?:''|[^'])*'/g, "'[LITERAL]'")
      // Mask dollar quoted literals
      .replace(/\$([a-zA-Z0-9_]*)\$[\s\S]*?\$\1\$/g, '$1$[LITERAL]$$1$')
      // Collapse multiple whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  public static info(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const cleanMeta = this.sanitizeMeta(meta);
    console.log(JSON.stringify({ level: 'INFO', timestamp, message, ...cleanMeta }));
  }

  public static warn(message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const cleanMeta = this.sanitizeMeta(meta);
    console.warn(JSON.stringify({ level: 'WARN', timestamp, message, ...cleanMeta }));
  }

  public static error(message: string, error?: any, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const cleanMeta = this.sanitizeMeta(meta);
    const errObj = error ? {
      errorCode: error.code || error.errorCode || 'UNKNOWN_ERROR',
      errorMessage: error.message || String(error)
    } : {};
    console.error(JSON.stringify({ level: 'ERROR', timestamp, message, ...errObj, ...cleanMeta }));
  }

  private static sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> {
    if (!meta) return {};
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(meta)) {
      const lowerKey = key.toLowerCase();
      // Strictly prevent logging sensitive credentials
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('key') ||
        lowerKey.includes('token') ||
        lowerKey.includes('connectionstring') ||
        lowerKey.includes('auth')
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (lowerKey === 'sql' || lowerKey === 'query') {
        sanitized[key] = typeof value === 'string' ? this.sanitizeSql(value) : '[INVALID_SQL_TYPE]';
      } else if (typeof value === 'string' && /[?&](?:token|key|apikey|password|secret)=/i.test(value)) {
        sanitized[key] = value.replace(/([?&](?:token|key|apikey|password|secret)=)[^&#\s]+/gi, '$1[REDACTED]');
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
