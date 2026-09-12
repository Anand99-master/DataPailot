import { Router, Request, Response } from 'express';
import { ConnectionManager } from '../database/ConnectionManager';
import { DatabaseConnectionParams } from '../database/DatabaseAdapter';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';
import { AuditLogger } from '../utils/auditLogger';

export const connectionRoutes = Router();
const connectionManager = ConnectionManager.getInstance();

// Helper to get session ID from cookie or header
export function getSessionId(req: Request, res: Response): string {
  let sessionId = req.cookies?.datapilot_session || (req.headers['x-session-id'] as string);
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    res.cookie('datapilot_session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }
  return sessionId;
}

/**
 * Validates connection parameters without saving secrets
 */
export function validateConnectionInput(body: any): { isValid: boolean; error?: string; params?: DatabaseConnectionParams } {
  const { type, host, port, database, username, password, ssl, filePath } = body;
  const resolvedType = type || 'postgresql';

  if (resolvedType === 'sqlite') {
    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
      return { isValid: false, error: 'SQLite connection requires a filePath.' };
    }
    return {
      isValid: true,
      params: {
        type: resolvedType,
        filePath: filePath.trim()
      }
    };
  }

  if (!host || typeof host !== 'string' || !host.trim()) {
    return { isValid: false, error: 'Database host is required.' };
  }
  if (!database || typeof database !== 'string' || !database.trim()) {
    return { isValid: false, error: 'Database name is required.' };
  }
  if (!username || typeof username !== 'string' || !username.trim()) {
    return { isValid: false, error: 'Database username is required.' };
  }

  const cleanHost = host.trim();
  const cleanDb = database.trim();
  const cleanUser = username.trim();

  if (cleanHost.length > 255) {
    return { isValid: false, error: 'Host name exceeds 255 characters.' };
  }
  if (cleanDb.length > 128) {
    return { isValid: false, error: 'Database name exceeds 128 characters.' };
  }
  if (cleanUser.length > 128) {
    return { isValid: false, error: 'Username exceeds 128 characters.' };
  }

  const parsedPort = Number(port);
  const cleanPort = isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535 ? 5432 : parsedPort;

  return {
    isValid: true,
    params: {
      type: resolvedType,
      host: cleanHost,
      port: cleanPort,
      database: cleanDb,
      username: cleanUser,
      password: password !== undefined ? String(password) : '',
      ssl: Boolean(ssl)
    }
  };
}

/**
 * POST /api/database/test
 * Tests database connectivity with provided credentials without saving state
 */
connectionRoutes.post('/test', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const validated = validateConnectionInput(req.body);
    if (!validated.isValid || !validated.params) {
      ApiResponse.error(res, 400, 'INVALID_CONNECTION_PARAMS', validated.error || 'Invalid parameters.');
      return;
    }

    const result = await connectionManager.testConnection(validated.params);
    Logger.info('Connection test completed', {
      database: validated.params.database,
      success: result.success,
      durationMs: Date.now() - startTime
    });

    res.json(result);
  } catch (err: any) {
    Logger.error('Connection test failed unexpectedly', err);
    ApiResponse.error(res, 500, 'CONNECTION_TEST_FAILED', err.message || 'Failed to test connection');
  }
});

/**
 * POST /api/database/connect
 * Establishes active database connection pool for the current session
 */
connectionRoutes.post('/connect', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const sessionId = getSessionId(req, res);

  try {
    const validated = validateConnectionInput(req.body);
    if (!validated.isValid || !validated.params) {
      ApiResponse.error(res, 400, 'INVALID_CONNECTION_PARAMS', validated.error || 'Invalid parameters.');
      return;
    }

    const connectionInfo = await connectionManager.connect(sessionId, validated.params);

    AuditLogger.record({
      type: 'DATABASE_CONNECTED',
      sessionId,
      status: 'success',
      durationMs: Date.now() - startTime,
      details: {
        database: connectionInfo.database,
        host: connectionInfo.host,
        port: connectionInfo.port,
        username: connectionInfo.username
      }
    });

    Logger.info('Database connected successfully', {
      sessionId,
      database: connectionInfo.database,
      host: connectionInfo.host
    });

    res.json({
      success: true,
      connection: connectionInfo
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    AuditLogger.record({
      type: 'DATABASE_CONNECTED',
      sessionId,
      status: 'failure',
      durationMs,
      details: { error: err.message || 'Connection failed' }
    });

    Logger.error('Database connection failed', err, { sessionId, durationMs });
    ApiResponse.error(res, 400, 'CONNECTION_FAILED', err.message || 'Connection failed');
  }
});

/**
 * POST /api/database/disconnect
 * Closes the active database connection pool
 */
connectionRoutes.post('/disconnect', async (req: Request, res: Response) => {
  const sessionId = getSessionId(req, res);
  try {
    await connectionManager.disconnect(sessionId);

    AuditLogger.record({
      type: 'DATABASE_DISCONNECTED',
      sessionId,
      status: 'success',
      details: {}
    });

    Logger.info('Database disconnected', { sessionId });

    res.json({
      success: true,
      message: 'Disconnected successfully'
    });
  } catch (err: any) {
    Logger.error('Database disconnect failed', err, { sessionId });
    ApiResponse.error(res, 500, 'DISCONNECT_FAILED', err.message || 'Failed to disconnect');
  }
});

/**
 * GET /api/database/status
 * Returns current connection status for session
 */
connectionRoutes.get('/status', (req: Request, res: Response) => {
  const sessionId = getSessionId(req, res);
  const info = connectionManager.getConnectionInfo(sessionId);
  res.json({
    isConnected: Boolean(info?.isConnected),
    connection: info
  });
});
