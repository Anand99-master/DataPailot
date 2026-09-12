import { AnalysisSqlGenerator } from '../database/AnalysisSqlGenerator';
import { Router, Request, Response } from 'express';
import { ConnectionManager } from '../database/ConnectionManager';
import { UnifiedDataLayer } from '../import/UnifiedDataLayer';
import { SqlDialect } from '../database/SqlDialect';
import { QuerySafetyValidator } from '../database/QuerySafetyValidator';
import { getSessionId } from './connectionRoutes';
import { ApiValidation } from '../utils/apiValidation';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';
import { AuditLogger } from '../utils/auditLogger';

export const queryRoutes = Router();
const connectionManager = ConnectionManager.getInstance();
const unifiedDataLayer = UnifiedDataLayer.getInstance();

const sqliteDialect: SqlDialect = {
  quoteIdentifier: (identifier: string) => `"${identifier.replace(/"/g, '""')}"`,
  formatLimit: (sql: string, limit: number) => `${sql} LIMIT ${limit}`,
  formatPagination: (sql: string, limit: number, offset: number) => `${sql} LIMIT ${limit} OFFSET ${offset}`,
  formatDate: (date: Date) => `'${date.toISOString()}'`,
  formatExplain: (sql: string) => `EXPLAIN QUERY PLAN ${sql}`,
  qualifyTable: (schema: string | undefined, table: string) => `"${table.replace(/"/g, '""')}"`
};

/**
 * POST /api/database/query
 * Safely executes a read-only analytical SQL query on the connected database or imported dataset
 */
queryRoutes.post('/query', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const sessionId = getSessionId(req, res);

  try {
    const adapter = connectionManager.getAdapter(sessionId);
    const importedDatasets = unifiedDataLayer.getDatasets(sessionId);

    // Step 1: Input Validation
    const sqlValidation = ApiValidation.validateSql(req.body.sql);
    if (!sqlValidation.isValid || !sqlValidation.cleanSql) {
      ApiResponse.error(
        res,
        400,
        'INVALID_SQL_INPUT',
        sqlValidation.error || 'Invalid SQL query string.'
      );
      return;
    }

    const { maxRows, timeoutMs } = ApiValidation.sanitizeQueryLimits(
      req.body.maxRows,
      req.body.timeoutMs
    );

    // Step 2: Check if this query targets an imported dataset
    const isImportedTarget =
      importedDatasets.length > 0 &&
      (!adapter ||
        !adapter.isConnected() ||
        /FROM\s+"?imported"?\./i.test(sqlValidation.cleanSql) ||
        importedDatasets.some(ds => sqlValidation.cleanSql!.includes(ds.tableName)));

    if (isImportedTarget) {
      const result = await unifiedDataLayer.executeQuery(sessionId, sqlValidation.cleanSql, {
        maxRows,
        timeoutMs
      });
      const executionDuration = Date.now() - startTime;

      res.json({
        success: true,
        result: {
          query: sqlValidation.cleanSql,
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
          executionTimeMs: result.executionTimeMs,
          isTruncated: result.isTruncated || false,
          totalAvailableRows: result.totalAvailableRows ?? result.rowCount,
          status: 'success'
        },
        error: null
      });
      return;
    }

    if (!adapter || !adapter.isConnected()) {
      Logger.warn('Query attempted without active connection', { sessionId });
      ApiResponse.error(
        res,
        400,
        'NOT_CONNECTED',
        'No active database connection. Connect a database before running queries.'
      );
      return;
    }

    // Step 2: Server-side Safety Validation (Strictly read-only analytical SQL)
    const safety = QuerySafetyValidator.validate(sqlValidation.cleanSql);
    if (!safety.isValid) {
      AuditLogger.record({
        type: 'QUERY_REJECTED',
        sessionId,
        status: 'failure',
        details: { reason: safety.error, statementType: safety.statementType }
      });
      Logger.warn('Query rejected by safety validator', {
        sessionId,
        reason: safety.error,
        sql: sqlValidation.cleanSql
      });

      ApiResponse.error(
        res,
        403,
        'SAFETY_VIOLATION',
        safety.error || 'Query blocked by safety validator.'
      );
      return;
    }

    // Step 3: Execute via Database Adapter with timeout and row limit guarantees
    const result = await adapter.executeReadOnlyQuery(sqlValidation.cleanSql, {
      maxRows,
      timeoutMs
    });

    const executionDuration = Date.now() - startTime;

    AuditLogger.record({
      type: 'QUERY_EXECUTED',
      sessionId,
      status: 'success',
      durationMs: executionDuration,
      details: {
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
        isTruncated: result.isTruncated
      }
    });

    Logger.info('Query executed successfully', {
      sessionId,
      rowCount: result.rowCount,
      durationMs: executionDuration,
      sql: sqlValidation.cleanSql
    });

    res.json({
      success: true,
      result: {
        query: sqlValidation.cleanSql,
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
        isTruncated: result.isTruncated || false,
        totalAvailableRows: result.totalAvailableRows ?? result.rowCount,
        status: 'success'
      },
      error: null
    });
  } catch (err: any) {
    const executionDuration = Date.now() - startTime;
    const errorMessage = err?.message || 'Error executing query';
    const isTimeout = errorMessage.toLowerCase().includes('timeout') || err?.code === '57014';
    const isConnLost =
      err?.code === '57P01' ||
      errorMessage.toLowerCase().includes('connection terminated') ||
      errorMessage.toLowerCase().includes('connection closed') ||
      errorMessage.toLowerCase().includes('connection lost');

    const errorCode = isTimeout
      ? 'QUERY_TIMEOUT'
      : isConnLost
      ? 'CONNECTION_LOST'
      : 'QUERY_EXECUTION_ERROR';

    AuditLogger.record({
      type: 'QUERY_REJECTED',
      sessionId,
      status: 'failure',
      durationMs: executionDuration,
      details: { errorCode, errorMessage }
    });

    Logger.error('Query execution failed', err, {
      sessionId,
      durationMs: executionDuration,
      errorCode
    });

    ApiResponse.error(res, 400, errorCode, errorMessage);
  }
});


/**
 * POST /api/database/analysis/generate
 * Dynamically generates analysis SQL queries using the active dialect
 */
queryRoutes.post('/analysis/generate', async (req: Request, res: Response) => {
  const sessionId = getSessionId(req, res);
  try {
    const adapter = connectionManager.getAdapter(sessionId);
    const importedDatasets = unifiedDataLayer.getDatasets(sessionId);

    let dialect: SqlDialect;
    if (!adapter || !adapter.isConnected()) {
      if (importedDatasets.length > 0) {
        dialect = sqliteDialect;
      } else {
        ApiResponse.error(res, 400, 'NOT_CONNECTED', 'No active database connection.');
        return;
      }
    } else {
      dialect = adapter.getDialect();
    }
    
    const generator = new AnalysisSqlGenerator(dialect);
    
    const { method, args } = req.body;
    if (typeof (generator as any)[method] !== 'function') {
      ApiResponse.error(res, 400, 'INVALID_METHOD', `Method ${method} not found`);
      return;
    }
    
    const result = (generator as any)[method](...args);
    res.json({ success: true, result });
  } catch (err: any) {
    Logger.error('Error generating analysis query', err, { sessionId });
    ApiResponse.error(res, 500, 'GENERATION_ERROR', err.message);
  }
});
