import { Router, Request, Response } from 'express';
import { ConnectionManager } from '../database/ConnectionManager';
import { UnifiedDataLayer } from '../import/UnifiedDataLayer';
import { getSessionId } from './connectionRoutes';
import { getSessionDatasetStoreKey } from '../utils/workspaceHelper';
import { ApiValidation } from '../utils/apiValidation';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';
import { AuditLogger } from '../utils/auditLogger';

export const schemaRoutes = Router();
const connectionManager = ConnectionManager.getInstance();
const unifiedDataLayer = UnifiedDataLayer.getInstance();

/**
 * GET /api/database/tables
 * Discovers all tables from the connected database schema and imported datasets
 */
schemaRoutes.get('/tables', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req, res);
    const storeKey = getSessionDatasetStoreKey(req, res);
    const adapter = connectionManager.getAdapter(sessionId);
    const importedTables = unifiedDataLayer.listDiscoveredTables(storeKey);

    if (!adapter || !adapter.isConnected()) {
      res.json({
        success: true,
        tables: importedTables,
        count: importedTables.length
      });
      return;
    }

    const schemaParam = req.query.schema as string | undefined;
    if (schemaParam) {
      const schemaVal = ApiValidation.validateIdentifier(schemaParam, 'Schema');
      if (!schemaVal.isValid) {
        ApiResponse.error(res, 400, 'INVALID_SCHEMA_IDENTIFIER', schemaVal.error || 'Invalid schema identifier.');
        return;
      }
    }

    const tables = await adapter.getTables(schemaParam);
    const allTables = [...tables, ...importedTables];

    res.json({
      success: true,
      tables: allTables,
      count: allTables.length
    });
  } catch (err: any) {
    Logger.error('Failed to discover tables', err);
    ApiResponse.error(res, 500, 'TABLE_DISCOVERY_FAILED', err.message || 'Failed to discover tables from database');
  }
});

/**
 * GET /api/database/tables/:schema/:table
 * Retrieves detailed column definitions, PKs, FKs, and row count for a table
 */
schemaRoutes.get('/tables/:schema/:table', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req, res);
    const storeKey = getSessionDatasetStoreKey(req, res);
    const adapter = connectionManager.getAdapter(sessionId);
    const { schema, table } = req.params;

    // Check if it's an imported dataset
    if (schema === 'imported' || !adapter || !adapter.isConnected()) {
      const importedDetails = unifiedDataLayer.getTableDetails(storeKey, table);
      if (importedDetails) {
        res.json({
          success: true,
          table: importedDetails
        });
        return;
      }
    }

    if (!adapter || !adapter.isConnected()) {
      ApiResponse.error(res, 400, 'NOT_CONNECTED', 'No database connected. Please connect a database first.');
      return;
    }

    const schemaVal = ApiValidation.validateIdentifier(schema, 'Schema');
    if (!schemaVal.isValid) {
      ApiResponse.error(res, 400, 'INVALID_IDENTIFIER', schemaVal.error || 'Invalid schema name.');
      return;
    }

    const tableVal = ApiValidation.validateIdentifier(table, 'Table');
    if (!tableVal.isValid) {
      ApiResponse.error(res, 400, 'INVALID_IDENTIFIER', tableVal.error || 'Invalid table name.');
      return;
    }

    const details = await adapter.getTableDetails(schemaVal.cleanName!, tableVal.cleanName!);
    res.json({
      success: true,
      table: details
    });
  } catch (err: any) {
    Logger.error('Failed to inspect table schema', err);
    ApiResponse.error(res, 500, 'SCHEMA_INSPECTION_FAILED', err.message || 'Failed to inspect table schema');
  }
});

/**
 * POST /api/database/refresh
 * Introspects and returns fresh tables and confirmed foreign-key relationships
 */
schemaRoutes.post('/refresh', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const sessionId = getSessionId(req, res);

  try {
    const adapter = connectionManager.getAdapter(sessionId);

    if (!adapter || !adapter.isConnected()) {
      ApiResponse.error(res, 400, 'NOT_CONNECTED', 'No database connected. Please connect a database first.');
      return;
    }

    const schemaParam = req.body?.schema as string | undefined;
    if (schemaParam) {
      const schemaVal = ApiValidation.validateIdentifier(schemaParam, 'Schema');
      if (!schemaVal.isValid) {
        ApiResponse.error(res, 400, 'INVALID_SCHEMA_IDENTIFIER', schemaVal.error || 'Invalid schema name.');
        return;
      }
    }

    const [tables, relationships] = await Promise.all([
      adapter.getTables(schemaParam),
      adapter.getRelationships(schemaParam)
    ]);

    const durationMs = Date.now() - startTime;

    AuditLogger.record({
      type: 'SCHEMA_REFRESHED',
      sessionId,
      status: 'success',
      durationMs,
      details: {
        tableCount: tables.length,
        relationshipCount: relationships.length
      }
    });

    Logger.info('Schema refreshed', {
      sessionId,
      tableCount: tables.length,
      relationshipCount: relationships.length,
      durationMs
    });

    res.json({
      success: true,
      tables,
      relationships,
      tableCount: tables.length,
      relationshipCount: relationships.length,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    Logger.error('Failed to refresh schema', err, { sessionId });
    ApiResponse.error(res, 500, 'SCHEMA_REFRESH_FAILED', err.message || 'Failed to refresh schema');
  }
});

/**
 * GET /api/database/relationships
 * Discovers foreign-key relationships across tables
 */
schemaRoutes.get('/relationships', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req, res);
    const adapter = connectionManager.getAdapter(sessionId);

    if (!adapter || !adapter.isConnected()) {
      res.json({
        success: true,
        relationships: [],
        count: 0
      });
      return;
    }

    const schemaParam = req.query.schema as string | undefined;
    if (schemaParam) {
      const schemaVal = ApiValidation.validateIdentifier(schemaParam, 'Schema');
      if (!schemaVal.isValid) {
        ApiResponse.error(res, 400, 'INVALID_SCHEMA_IDENTIFIER', schemaVal.error || 'Invalid schema name.');
        return;
      }
    }

    const relationships = await adapter.getRelationships(schemaParam);

    res.json({
      success: true,
      relationships,
      count: relationships.length
    });
  } catch (err: any) {
    Logger.error('Failed to discover relationships', err);
    ApiResponse.error(res, 500, 'RELATIONSHIP_DISCOVERY_FAILED', err.message || 'Failed to discover relationships');
  }
});
