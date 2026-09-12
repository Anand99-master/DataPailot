export interface SafetyValidationResult {
  isValid: boolean;
  error?: string;
  statementType?: string;
}

export class QuerySafetyValidator {
  private static readonly FORBIDDEN_KEYWORDS = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    'GRANT',
    'REVOKE',
    'MERGE',
    'REPLACE',
    'EXEC',
    'EXECUTE',
    'CALL',
    'COPY',
    'VACUUM',
    'REINDEX',
    'CLUSTER',
    'COMMENT',
    'LOCK',
    'SET',
    'RESET',
    'DO',
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    'START',
    'SAVEPOINT',
    'RELEASE',
    'CHECKPOINT',
    'SHUTDOWN',
    'LISTEN',
    'NOTIFY',
    'DISCARD',
    'REASSIGN',
    'LOAD',
    'DEALLOCATE',
    'PREPARE',
    'ANALYZE',
    'ATTACH',
    'DETACH',
    'PRAGMA',
    'DBCC',
    'BACKUP',
    'RESTORE',
    'DENY',
    'OPENROWSET',
    'BULK INSERT',
    'DECLARE',
    'BEGIN',
    'DBMS_'
  ];

  private static readonly FORBIDDEN_FUNCTIONS = [
    'pg_sleep',
    'pg_terminate_backend',
    'pg_cancel_backend',
    'pg_read_file',
    'pg_read_binary_file',
    'pg_ls_dir',
    'dblink',
    'dblink_exec',
    'lo_import',
    'lo_export',
    'query_to_xml'
  ];

  /**
   * Validates that the query contains only read-only analytical SQL (SELECT, WITH)
   * and blocks destructive or modification statements, transaction manipulation, multi-statements, and injection attacks.
   */
  public static validate(sql: string): SafetyValidationResult {
    if (!sql || !sql.trim()) {
      return { isValid: false, error: 'Query cannot be empty' };
    }

    // Check for null bytes or dangerous control characters
    if (/\0/.test(sql)) {
      return { isValid: false, error: 'Security Guard: Query contains null byte character.' };
    }

    // Strip comments (line comments -- and block comments /* */) and string literals safely
    const sanitized = this.stripCommentsAndLiterals(sql);

    // Split multiple statements if any (separated by semicolon)
    const statements = this.splitStatements(sql);

    if (statements.length === 0) {
      return { isValid: false, error: 'Query contains no executable statements' };
    }

    // Strict single-statement enforcement for read-only analytical safety
    if (statements.length > 1) {
      return {
        isValid: false,
        error: 'Only one read-only SQL statement is allowed. Multi-statement queries are strictly blocked.'
      };
    }

    const stmt = statements[0];
    const match = stmt.match(/^([a-zA-Z]+)/);
    if (!match) {
      return { isValid: false, error: 'Invalid query syntax' };
    }

    const primaryKeyword = match[1].toUpperCase();

    // Only allow SELECT, WITH, or pure read-only EXPLAIN (without ANALYZE)
    if (primaryKeyword === 'EXPLAIN') {
      if (/\bANALYZE\b/i.test(stmt)) {
        return {
          isValid: false,
          error: 'Security Guard: EXPLAIN ANALYZE is blocked as it executes the underlying query. Use pure EXPLAIN.',
          statementType: 'EXPLAIN'
        };
      }
      // Check that EXPLAIN explains a SELECT or WITH
      const explainRemainder = stmt.replace(/^EXPLAIN\s+(?:\([^)]*\)\s+)?/i, '').trim();
      const explainMatch = explainRemainder.match(/^([a-zA-Z]+)/);
      const innerKeyword = explainMatch ? explainMatch[1].toUpperCase() : '';
      if (!['SELECT', 'WITH', 'QUERY'].includes(innerKeyword)) {
        return {
          isValid: false,
          error: `Read-only Mode: EXPLAIN must be followed by SELECT or WITH. Statement "${innerKeyword}" is blocked.`,
          statementType: innerKeyword
        };
      }
    } else if (!['SELECT', 'WITH'].includes(primaryKeyword)) {
      return {
        isValid: false,
        error: `Read-only Mode: Only SELECT and WITH statements are permitted. Statement starting with "${primaryKeyword}" is blocked.`,
        statementType: primaryKeyword
      };
    }

    // Replace double-quoted identifiers with placeholder to prevent false positives on column aliases
    const unquotedSql = stmt.replace(/"(?:""|[^"])*"/g, '__IDENT__');

    // Check all tokens in the statement for forbidden modification/destructive keywords
    for (const keyword of this.FORBIDDEN_KEYWORDS) {
      if (this.isDestructivePattern(unquotedSql, keyword)) {
        return {
          isValid: false,
          error: `Security Guard: Blocked forbidden operation "${keyword}". DataPilot operates in strict Read-Only mode.`,
          statementType: keyword
        };
      }
    }

    // Check for dangerous administrative/system functions
    for (const func of this.FORBIDDEN_FUNCTIONS) {
      const funcRegex = new RegExp(`\\b${func}\\s*\\(`, 'i');
      if (funcRegex.test(unquotedSql)) {
        return {
          isValid: false,
          error: `Security Guard: Blocked administrative/system function "${func}()". DataPilot operates in strict Read-Only analytical mode.`,
          statementType: func
        };
      }
    }

    return { isValid: true, statementType: primaryKeyword };
  }

  public static splitStatements(sql: string): string[] {
    const sanitized = this.stripCommentsAndLiterals(sql);
    return sanitized
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private static stripCommentsAndLiterals(sql: string): string {
    let result = sql;

    // Strip dollar-quoted strings in PostgreSQL: $$ ... $$ or $tag$ ... $tag$
    result = result.replace(/\$([a-zA-Z0-9_]*)\$[\s\S]*?\$\1\$/g, ' ');

    // Strip single-quoted strings (handling escaped quotes '')
    result = result.replace(/'(?:''|[^'])*'/g, "''");

    // Strip block comments /* ... */ (including multiline)
    // Repeat to handle consecutive or nested blocks
    let prev;
    do {
      prev = result;
      result = result.replace(/\/\*[\s\S]*?\*\//g, ' ');
    } while (result !== prev && result.includes('/*'));

    // Strip line comments -- ...
    result = result.replace(/--.*$/gm, ' ');

    return result;
  }

  private static isDestructivePattern(statement: string, keyword: string): boolean {
    const destructiveRegexes: Record<string, RegExp> = {
      DROP: /\bDROP\b/i,
      DELETE: /\bDELETE\b/i,
      TRUNCATE: /\bTRUNCATE\b/i,
      UPDATE: /\bUPDATE\b/i,
      INSERT: /\bINSERT\b/i,
      ALTER: /\bALTER\b/i,
      CREATE: /\bCREATE\b/i,
      GRANT: /\bGRANT\b/i,
      REVOKE: /\bREVOKE\b/i,
      MERGE: /\bMERGE\b/i,
      CALL: /\bCALL\b/i,
      COPY: /\bCOPY\b/i,
      VACUUM: /\bVACUUM\b/i,
      REINDEX: /\bREINDEX\b/i,
      CLUSTER: /\bCLUSTER\b/i,
      COMMENT: /\bCOMMENT\s+ON\b/i,
      LOCK: /\bLOCK\b/i,
      SET: /\bSET\s+/i,
      RESET: /\bRESET\s+/i,
      DO: /\bDO\s+/i,
      EXEC: /\bEXEC(UTE)?\b/i,
      EXECUTE: /\bEXEC(UTE)?\b/i,
      REPLACE: /\bREPLACE\s+FUNCTION\b/i,
      BEGIN: /\bBEGIN\b/i,
      COMMIT: /\bCOMMIT\b/i,
      ROLLBACK: /\bROLLBACK\b/i,
      START: /\bSTART\s+TRANSACTION\b/i,
      SAVEPOINT: /\bSAVEPOINT\b/i,
      RELEASE: /\bRELEASE\s+SAVEPOINT\b/i,
      CHECKPOINT: /\bCHECKPOINT\b/i,
      SHUTDOWN: /\bSHUTDOWN\b/i,
      LISTEN: /\bLISTEN\b/i,
      NOTIFY: /\bNOTIFY\b/i,
      DISCARD: /\bDISCARD\b/i,
      REASSIGN: /\bREASSIGN\s+OWNED\b/i,
      LOAD: /\bLOAD\b/i,
      DEALLOCATE: /\bDEALLOCATE\b/i,
      PREPARE: /\bPREPARE\b/i,
      ANALYZE: /\bANALYZE\b/i,
      ATTACH: /\bATTACH\b/i,
      DETACH: /\bDETACH\b/i,
      PRAGMA: /\bPRAGMA\b/i,
      DBCC: /\bDBCC\b/i,
      BACKUP: /\bBACKUP\b/i,
      RESTORE: /\bRESTORE\b/i,
      DENY: /\bDENY\b/i,
      OPENROWSET: /\bOPENROWSET\b/i,
      'BULK INSERT': /\bBULK\s+INSERT\b/i,
      DECLARE: /\bDECLARE\b/i,
      DBMS_: /\bDBMS_[A-Z0-9_]+\b/i,
      PLSQL_BEGIN: /(^|;)\s*BEGIN\b/i
    };

    if (destructiveRegexes[keyword]) {
      return destructiveRegexes[keyword].test(statement);
    }

    const directRegex = new RegExp(`(^|;)\\s*${keyword}\\b`, 'i');
    return directRegex.test(statement);
  }
}
