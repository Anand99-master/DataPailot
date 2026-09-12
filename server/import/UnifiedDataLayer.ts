import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import * as XLSX from 'xlsx';
import {
  ImportedDataset,
  ColumnMetadata,
  DataPreview,
  DataProfile,
  OperationSupportStatus,
  ExportFormat
} from '../../src/types/import';
import { DiscoveredTable, TableDetailsResult, TableColumnInfo, QueryResultData } from '../database/DatabaseAdapter';
import { QuerySafetyValidator } from '../database/QuerySafetyValidator';
import { ImportSecurity } from './ImportSecurity';
import { DataProfiler } from './DataProfiler';
import { Logger } from '../utils/logger';

interface SessionDatasetStore {
  db: DatabaseSync;
  datasets: Map<string, ImportedDataset>;
  tableToDatasetMap: Map<string, string>; // tableName -> datasetId
  lastActive: number;
}

export class UnifiedDataLayer {
  private static instance: UnifiedDataLayer;
  private sessionStores = new Map<string, SessionDatasetStore>();

  private constructor() {
    // Cleanup inactive stores after 1 hour of inactivity
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, store] of this.sessionStores.entries()) {
        if (now - store.lastActive > 60 * 60 * 1000) {
          try {
            store.db.close();
          } catch {}
          this.sessionStores.delete(sessionId);
        }
      }
    }, 10 * 60 * 1000);
  }

  public static getInstance(): UnifiedDataLayer {
    if (!UnifiedDataLayer.instance) {
      UnifiedDataLayer.instance = new UnifiedDataLayer();
    }
    return UnifiedDataLayer.instance;
  }

  /**
   * Retrieves or initializes the in-memory SQLite store for a session
   */
  private getStore(sessionId: string): SessionDatasetStore {
    let store = this.sessionStores.get(sessionId);
    if (!store) {
      const db = new DatabaseSync(':memory:');
      store = {
        db,
        datasets: new Map(),
        tableToDatasetMap: new Map(),
        lastActive: Date.now()
      };
      this.sessionStores.set(sessionId, store);
    }
    store.lastActive = Date.now();
    return store;
  }

  /**
   * Imports a parsed dataset into the unified data layer
   */
  public async registerDataset(
    sessionId: string,
    params: {
      sourceName: string;
      fileType: 'CSV' | 'XLSX' | 'JSON';
      columns: ColumnMetadata[];
      rows: Record<string, unknown>[];
      fileSize?: number;
      sheets?: string[];
      selectedSheet?: string;
    }
  ): Promise<ImportedDataset> {
    const store = this.getStore(sessionId);
    const datasetId = `ds_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    // Generate unique SQL table name
    const baseTableName = ImportSecurity.toSafeSqlTableName(params.sourceName);
    let tableName = baseTableName;
    let counter = 1;
    while (store.tableToDatasetMap.has(tableName)) {
      tableName = `${baseTableName}_${counter++}`;
    }

    // Map column types to SQLite column definitions
    const colDefs = params.columns.map(c => {
      let sqlType = 'TEXT';
      if (c.dataType === 'integer') sqlType = 'INTEGER';
      else if (c.dataType === 'numeric') sqlType = 'REAL';
      else if (c.dataType === 'boolean') sqlType = 'INTEGER';
      return `"${c.name.replace(/"/g, '""')}" ${sqlType}`;
    });

    const createSql = `CREATE TABLE "${tableName}" (${colDefs.join(', ')});`;
    store.db.exec(createSql);

    // Batch insert rows using prepared statement
    if (params.rows.length > 0) {
      const colPlaceholders = params.columns.map(() => '?').join(', ');
      const quotedColNames = params.columns.map(c => `"${c.name.replace(/"/g, '""')}"`).join(', ');
      const insertSql = `INSERT INTO "${tableName}" (${quotedColNames}) VALUES (${colPlaceholders});`;
      const insertStmt = store.db.prepare(insertSql);

      store.db.exec('BEGIN TRANSACTION;');
      try {
        for (const row of params.rows) {
          const values = params.columns.map(c => {
            const v = row[c.name];
            if (v === undefined || v === null) return null;
            if (c.dataType === 'boolean') return v ? 1 : 0;
            if (typeof v === 'object') return JSON.stringify(v);
            return v;
          });
          insertStmt.run(...(values as any));
        }
        store.db.exec('COMMIT;');
      } catch (err) {
        store.db.exec('ROLLBACK;');
        throw err;
      }
    }

    // Auto-profile dataset
    const profile = DataProfiler.profile(
      datasetId,
      params.sourceName,
      params.columns,
      params.rows
    );

    const previewRows = params.rows.slice(0, ImportSecurity.MAX_PREVIEW_ROWS);

    const dataset: ImportedDataset = {
      datasetId,
      sourceType: 'FILE',
      sourceName: params.sourceName,
      fileType: params.fileType,
      rowCount: params.rows.length,
      columns: params.columns,
      schema: 'imported',
      name: params.sourceName,
      tableName,
      previewRows,
      importTimestamp: new Date().toISOString(),
      status: 'ready',
      sheets: params.sheets,
      selectedSheet: params.selectedSheet,
      fileSize: params.fileSize,
      profile
    };

    store.datasets.set(datasetId, dataset);
    store.tableToDatasetMap.set(tableName, datasetId);

    Logger.info('Imported dataset registered in UnifiedDataLayer', {
      sessionId,
      datasetId,
      tableName,
      rowCount: params.rows.length,
      columnCount: params.columns.length
    });

    return dataset;
  }

  /**
   * Lists all imported datasets for a session
   */
  public getDatasets(sessionId: string): ImportedDataset[] {
    const store = this.getStore(sessionId);
    return Array.from(store.datasets.values());
  }

  /**
   * Retrieves a single dataset by ID
   */
  public getDataset(sessionId: string, datasetId: string): ImportedDataset | null {
    const store = this.getStore(sessionId);
    return store.datasets.get(datasetId) || null;
  }

  /**
   * Retrieves a dataset by table name
   */
  public getDatasetByTableName(sessionId: string, tableName: string): ImportedDataset | null {
    const store = this.getStore(sessionId);
    const dsId = store.tableToDatasetMap.get(tableName);
    if (dsId) {
      return store.datasets.get(dsId) || null;
    }
    return null;
  }

  /**
   * Retrieves preview data for a dataset
   */
  public getPreview(sessionId: string, datasetId: string): DataPreview | null {
    const ds = this.getDataset(sessionId, datasetId);
    if (!ds) return null;
    return {
      datasetId: ds.datasetId,
      datasetName: ds.name,
      fileType: ds.fileType,
      rowCount: ds.rowCount,
      columnCount: ds.columns.length,
      columns: ds.columns,
      rows: ds.previewRows,
      previewRowCount: ds.previewRows.length
    };
  }

  public getDataPreview(sessionId: string, datasetId: string, limit?: number): DataPreview | null {
    return this.getPreview(sessionId, datasetId);
  }

  /**
   * Renames an imported dataset
   */
  public renameDataset(sessionId: string, datasetId: string, newName: string): ImportedDataset {
    const store = this.getStore(sessionId);
    const ds = store.datasets.get(datasetId);
    if (!ds) {
      throw new Error(`Dataset with ID '${datasetId}' not found.`);
    }

    const cleanName = newName.trim();
    if (!cleanName) {
      throw new Error('Dataset name cannot be empty.');
    }

    ds.name = cleanName;
    if (ds.profile) {
      ds.profile.datasetName = cleanName;
    }

    return ds;
  }

  /**
   * Removes an imported dataset and drops its in-memory table
   */
  public removeDataset(sessionId: string, datasetId: string): boolean {
    const store = this.getStore(sessionId);
    const ds = store.datasets.get(datasetId);
    if (!ds) return false;

    try {
      store.db.exec(`DROP TABLE IF EXISTS "${ds.tableName}";`);
    } catch (e) {}

    store.tableToDatasetMap.delete(ds.tableName);
    store.datasets.delete(datasetId);

    Logger.info('Imported dataset removed', { sessionId, datasetId, tableName: ds.tableName });
    return true;
  }

  public deleteDataset(sessionId: string, datasetId: string): boolean {
    return this.removeDataset(sessionId, datasetId);
  }

  /**
   * Lists discovered tables conforming to DiscoveredTable interface
   */
  public listDiscoveredTables(sessionId: string): DiscoveredTable[] {
    const store = this.getStore(sessionId);
    return Array.from(store.datasets.values()).map(ds => ({
      schema: 'imported',
      name: ds.tableName,
      type: 'TABLE',
      approximateRowCount: ds.rowCount
    }));
  }

  /**
   * Retrieves TableDetailsResult conforming to DatabaseAdapter interface
   */
  public getTableDetails(sessionId: string, tableName: string): TableDetailsResult | null {
    const store = this.getStore(sessionId);
    const ds = this.getDatasetByTableName(sessionId, tableName);
    if (!ds) return null;

    const columns: TableColumnInfo[] = ds.columns.map((c, idx) => ({
      name: c.name,
      dataType: c.dataType,
      isNullable: c.isNullable,
      defaultValue: null,
      isPrimaryKey: idx === 0, // Mark first column or ID column as primary key hint
      isForeignKey: false
    }));

    return {
      schema: 'imported',
      name: ds.tableName,
      type: 'TABLE',
      columnCount: ds.columns.length,
      approximateRowCount: ds.rowCount,
      columns,
      outgoingRelationships: [],
      incomingRelationships: []
    };
  }

  /**
   * Executes a read-only analytical SQL query on imported datasets
   */
  public async executeQuery(
    sessionId: string,
    sql: string,
    options: { maxRows?: number; timeoutMs?: number } = {}
  ): Promise<QueryResultData> {
    const startTime = Date.now();
    const store = this.getStore(sessionId);

    // Validate read-only analytical safety
    const safety = QuerySafetyValidator.validate(sql);
    if (!safety.isValid) {
      throw new Error(`Query safety violation: ${safety.error}`);
    }

    const maxRows = options.maxRows || 1000;
    
    // Adapt any "imported." prefix if user used qualify schema: "imported"."table" -> "table"
    const normalizedSql = sql.replace(/(?:FROM|JOIN)\s+"?imported"?\."?([a-zA-Z0-9_]+)"?/gi, 'FROM "$1"');

    try {
      const stmt = store.db.prepare(normalizedSql);
      const rawRows = stmt.all() as Record<string, unknown>[];
      const executionTimeMs = Date.now() - startTime;

      const isTruncated = rawRows.length > maxRows;
      const rows = isTruncated ? rawRows.slice(0, maxRows) : rawRows;

      // Extract columns from first row if available, or empty
      const columnNames = rows.length > 0 ? Object.keys(rows[0]) : [];
      const columns = columnNames.map(name => ({
        name,
        dataType: 'text' // General type descriptor
      }));

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs,
        isTruncated,
        totalAvailableRows: rawRows.length
      };
    } catch (err: any) {
      throw new Error(`SQL execution error on imported dataset: ${err.message}`);
    }
  }

  /**
   * Exports a dataset to CSV, JSON, or XLSX format with formula injection protection
   */
  public exportDataset(
    sessionId: string,
    datasetId: string,
    format: ExportFormat
  ): { mimeType: string; fileName: string; content: string | Buffer } {
    const store = this.getStore(sessionId);
    const ds = store.datasets.get(datasetId);
    if (!ds) {
      throw new Error(`Dataset with ID '${datasetId}' not found.`);
    }

    // Fetch all rows from SQLite
    const stmt = store.db.prepare(`SELECT * FROM "${ds.tableName}";`);
    const allRows = stmt.all() as Record<string, unknown>[];

    const safeBaseName = ds.name.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'json') {
      const jsonContent = JSON.stringify(allRows, null, 2);
      return {
        mimeType: 'application/json; charset=utf-8',
        fileName: `${safeBaseName}.json`,
        content: jsonContent
      };
    }

    if (format === 'csv') {
      // Build CSV with formula injection protection
      const colNames = ds.columns.map(c => c.name);
      const headerLine = colNames.map(c => `"${c.replace(/"/g, '""')}"`).join(',');

      const rowLines = allRows.map(row => {
        return colNames.map(c => {
          const val = row[c];
          if (val === null || val === undefined) return '';
          // Prevent formula injection
          const safeVal = ImportSecurity.sanitizeFormulaInjection(val);
          // Quoting
          return `"${String(safeVal).replace(/"/g, '""')}"`;
        }).join(',');
      });

      // Include UTF-8 BOM so Excel opens UTF-8 properly
      const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
      return {
        mimeType: 'text/csv; charset=utf-8',
        fileName: `${safeBaseName}.csv`,
        content: csvContent
      };
    }

    if (format === 'xlsx') {
      // Sanitize rows for formula injection
      const sanitizedRows = allRows.map(row => {
        const cleanRow: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          cleanRow[k] = ImportSecurity.sanitizeFormulaInjection(v);
        }
        return cleanRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(sanitizedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, ds.name.slice(0, 31));

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `${safeBaseName}.xlsx`,
        content: buffer
      };
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Returns analytical capability matrix for imported datasets
   */
  public getCapabilities(): OperationSupportStatus[] {
    return [
      { operation: 'Filtering', category: 'BASIC', status: 'SUPPORTED' },
      { operation: 'Aggregation', category: 'AGGREGATION', status: 'SUPPORTED' },
      { operation: 'Grouping & HAVING', category: 'GROUPING', status: 'SUPPORTED' },
      { operation: 'Calculations & CASE', category: 'CALCULATIONS', status: 'SUPPORTED' },
      { operation: 'Date Analysis', category: 'DATE_ANALYSIS', status: 'SUPPORTED' },
      { operation: 'Ranking', category: 'RANKING', status: 'SUPPORTED' },
      { operation: 'Window Functions', category: 'WINDOW_FUNCTIONS', status: 'SUPPORTED' },
      { operation: 'Custom Columns', category: 'CUSTOM_COLUMNS', status: 'SUPPORTED' },
      { operation: 'Data Quality Profiling', category: 'DATA_QUALITY', status: 'SUPPORTED' },
      { operation: 'Cohort Analysis', category: 'ADVANCED_ANALYTICS', status: 'SUPPORTED' },
      { operation: 'Retention Analysis', category: 'ADVANCED_ANALYTICS', status: 'SUPPORTED' },
      { operation: 'Conversion Funnel', category: 'ADVANCED_ANALYTICS', status: 'SUPPORTED' },
      { operation: 'Multi-Dataset Joins', category: 'JOIN', status: 'SUPPORTED', reason: 'Cross-table JOIN on matching column names' },
      { operation: 'Foreign Key Auto-Discovery', category: 'SCHEMA', status: 'NOT APPLICABLE', reason: 'File datasets do not maintain foreign key constraints' },
      { operation: 'Stored Procedures', category: 'SYSTEM', status: 'UNSUPPORTED', reason: 'Stored procedures are not available on imported files' }
    ];
  }

  public getOperationCapabilities(sessionId?: string, datasetId?: string): OperationSupportStatus[] {
    return this.getCapabilities();
  }
}
