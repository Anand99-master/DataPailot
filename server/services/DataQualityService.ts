import { ConnectionManager } from '../database/ConnectionManager';
import { UnifiedDataLayer } from '../import/UnifiedDataLayer';
import { DataProfiler } from '../import/DataProfiler';
import { DataProfile, ColumnMetadata, QualityIssue } from '../../src/types/import';

export class DataQualityService {
  public static async profile(
    sessionId: string,
    schema: string,
    table: string,
    isImported: boolean
  ): Promise<DataProfile> {
    const totalRows = await this.getRowCount(sessionId, schema, table, isImported);
    const sampleSize = 10000;
    const { columns, rows } = await this.getSample(sessionId, schema, table, isImported, sampleSize);

    const baseProfile = DataProfiler.profile(
      `${schema}.${table}`,
      table,
      columns,
      rows,
      sampleSize
    );

    baseProfile.totalRows = totalRows;
    return this.enrichProfile(baseProfile, rows);
  }

  private static async getRowCount(sessionId: string, schema: string, table: string, isImported: boolean): Promise<number> {
    if (isImported) {
      const uds = UnifiedDataLayer.getInstance();
      const dataset = uds.getDatasets(sessionId).find(ds => ds.tableName === table);
      if (dataset) return dataset.rowCount;
      const res = await uds.executeQuery(sessionId, `SELECT COUNT(*) as cnt FROM "${table}"`);
      return Number(res.rows[0]?.cnt) || 0;
    } else {
      const adapter = ConnectionManager.getInstance().getAdapter(sessionId);
      if (!adapter) throw new Error('No active database connection');
      const dialect = adapter.getDialect();
      const query = `SELECT COUNT(*) as cnt FROM ${dialect.qualifyTable(schema, table)}`;
      const res = await adapter.executeReadOnlyQuery(query);
      return Number(res.rows[0]?.cnt) || 0;
    }
  }

  private static async getSample(sessionId: string, schema: string, table: string, isImported: boolean, limit: number): Promise<{ columns: ColumnMetadata[], rows: Record<string, unknown>[] }> {
    if (isImported) {
      const uds = UnifiedDataLayer.getInstance();
      const dataset = uds.getDatasets(sessionId).find(ds => ds.tableName === table);
      
      const res = await uds.executeQuery(sessionId, `SELECT * FROM "${table}" LIMIT ${limit}`);
      
      let columns: ColumnMetadata[];
      if (dataset && dataset.columns.length > 0) {
        columns = res.columns.map(c => {
          const matched = dataset.columns.find(dc => dc.name === c.name);
          return {
            name: c.name,
            dataType: matched ? matched.dataType : this.mapDataType(c.dataType),
            isNullable: true,
            nullCount: 0,
            sampleValues: []
          };
        });
      } else {
        columns = res.columns.map(c => ({
          name: c.name,
          dataType: this.mapDataType(c.dataType),
          isNullable: true,
          nullCount: 0,
          sampleValues: []
        }));
      }
      return { columns, rows: res.rows };
    } else {
      const adapter = ConnectionManager.getInstance().getAdapter(sessionId);
      if (!adapter) throw new Error('No active database connection');
      const dialect = adapter.getDialect();
      const query = dialect.formatLimit(`SELECT * FROM ${dialect.qualifyTable(schema, table)}`, limit);
      const res = await adapter.executeReadOnlyQuery(query);
      const columns = res.columns.map(c => ({
        name: c.name, dataType: this.mapDataType(c.dataType), isNullable: true, nullCount: 0, sampleValues: []
      } as ColumnMetadata));
      return { columns, rows: res.rows };
    }
  }

  private static mapDataType(dt: string): 'text' | 'integer' | 'numeric' | 'boolean' | 'date' | 'timestamp' | 'unknown' {
    const t = (dt || '').toLowerCase();
    if (t.includes('int')) return 'integer';
    if (t.includes('float') || t.includes('double') || t.includes('decimal') || t.includes('numeric') || t.includes('real')) return 'numeric';
    if (t.includes('bool')) return 'boolean';
    if (t.includes('date')) return 'date';
    if (t.includes('time')) return 'timestamp';
    if (t.includes('char') || t.includes('text') || t.includes('string') || t.includes('varchar')) return 'text';
    return 'unknown';
  }

  private static enrichProfile(profile: DataProfile, sampleRows: Record<string, unknown>[]): DataProfile {
    const issues: QualityIssue[] = [];
    const sampleSize = sampleRows.length;
    let totalScore = 100;

    // Detect duplicate full rows
    const rowStrings = sampleRows.map(r => JSON.stringify(r));
    const uniqueRows = new Set(rowStrings);
    const duplicateRowCountSample = sampleSize - uniqueRows.size;
    const duplicateRowPercentage = sampleSize > 0 ? (duplicateRowCountSample / sampleSize) * 100 : 0;
    
    profile.duplicateRowCount = Math.round((duplicateRowPercentage / 100) * profile.totalRows);
    profile.duplicateRowPercentage = Math.round(duplicateRowPercentage * 100) / 100;

    if (profile.duplicateRowPercentage > 0) {
      issues.push({
        severity: profile.duplicateRowPercentage > 5 ? 'Critical' : 'Warning',
        column: 'TABLE_LEVEL',
        issue: 'Fully duplicated rows detected',
        affectedRowCount: profile.duplicateRowCount,
        affectedPercentage: profile.duplicateRowPercentage,
        recommendedAction: 'Investigate source system for duplicate inserts or missing distinct constraints.'
      });
      totalScore -= Math.min(20, profile.duplicateRowPercentage * 2);
    }

    const now = new Date();

    for (const [colName, colProfile] of Object.entries(profile.columns)) {
      const values = sampleRows.map(r => r[colName]);
      
      let emptyCount = 0;
      let whitespaceCount = 0;
      let invalidDateCount = 0;
      let futureDateCount = 0;
      let zeroCount = 0;
      let negativeCount = 0;
      let outlierCount = 0;
      let typeInconsistentCount = 0;

      for (const v of values) {
        if (v === '') emptyCount++;
        else if (typeof v === 'string' && v.trim() === '' && v.length > 0) whitespaceCount++;

        // Type consistency checks
        if (colProfile.dataType === 'numeric' || colProfile.dataType === 'integer') {
          if (v !== null && v !== undefined && v !== '') {
            const num = Number(v);
            if (isNaN(num)) typeInconsistentCount++;
            else {
              if (num === 0) zeroCount++;
              if (num < 0) negativeCount++;
            }
          }
        } else if (colProfile.dataType === 'date' || colProfile.dataType === 'timestamp') {
          if (v !== null && v !== undefined && v !== '') {
            const d = new Date(String(v));
            if (isNaN(d.getTime())) invalidDateCount++;
            else if (d > now) futureDateCount++;
          }
        }
      }

      // Outlier calculation using IQR
      if (colProfile.numericDistribution && sampleSize > 0) {
        const iqr = colProfile.numericDistribution.q75 - colProfile.numericDistribution.q25;
        const lowerBound = colProfile.numericDistribution.q25 - 1.5 * iqr;
        const upperBound = colProfile.numericDistribution.q75 + 1.5 * iqr;
        
        for (const v of values) {
          if (v !== null && v !== undefined && v !== '') {
            const num = Number(v);
            if (!isNaN(num) && (num < lowerBound || num > upperBound)) {
              outlierCount++;
            }
          }
        }
      }

      // totalMissing uses nullCount (which already includes empty strings via DataProfiler) + whitespaceCount
      const totalMissing = colProfile.nullCount + whitespaceCount;
      const missingPercentage = sampleSize > 0 ? (totalMissing / sampleSize) * 100 : 0;
      
      colProfile.missingCount = Math.round((missingPercentage / 100) * profile.totalRows);
      colProfile.missingPercentage = Math.round(missingPercentage * 100) / 100;
      colProfile.emptyStringCount = Math.round((emptyCount / sampleSize) * profile.totalRows) || 0;
      colProfile.whitespaceCount = Math.round((whitespaceCount / sampleSize) * profile.totalRows) || 0;
      colProfile.zeroCount = Math.round((zeroCount / sampleSize) * profile.totalRows) || 0;
      colProfile.negativeCount = Math.round((negativeCount / sampleSize) * profile.totalRows) || 0;
      
      const outlierPercentage = sampleSize > 0 ? (outlierCount / sampleSize) * 100 : 0;
      colProfile.outlierCount = Math.round((outlierPercentage / 100) * profile.totalRows) || 0;
      colProfile.outlierPercentage = Math.round(outlierPercentage * 100) / 100;

      const typeConsistencyPercentage = sampleSize > 0 ? 100 - ((typeInconsistentCount / sampleSize) * 100) : 100;
      colProfile.typeConsistencyPercentage = Math.round(typeConsistencyPercentage * 100) / 100;

      colProfile.invalidDateCount = Math.round((invalidDateCount / sampleSize) * profile.totalRows) || 0;
      colProfile.futureDateCount = Math.round((futureDateCount / sampleSize) * profile.totalRows) || 0;

      // Quality Status Scoring per column
      let colScore = 100;
      if (missingPercentage > 5) colScore -= 10;
      if (missingPercentage > 20) colScore -= 20;
      if (outlierPercentage > 5) colScore -= 10;
      if (typeConsistencyPercentage < 99) colScore -= 20;
      if (colProfile.invalidDateCount > 0) colScore -= 15;

      if (colScore >= 90) colProfile.qualityStatus = 'Good';
      else if (colScore >= 70) colProfile.qualityStatus = 'Warning';
      else colProfile.qualityStatus = 'Critical';

      // Generate Issues
      if (missingPercentage > 5) {
        issues.push({
          severity: missingPercentage > 20 ? 'Critical' : 'Warning',
          column: colName,
          issue: 'High missing value rate',
          affectedRowCount: colProfile.missingCount,
          affectedPercentage: colProfile.missingPercentage,
          recommendedAction: 'Filter rows or impute missing data.'
        });
        totalScore -= Math.min(15, missingPercentage);
      }

      if (outlierPercentage > 2) {
        issues.push({
          severity: outlierPercentage > 10 ? 'Critical' : 'Info',
          column: colName,
          issue: 'Statistical outliers detected (1.5x IQR)',
          affectedRowCount: colProfile.outlierCount,
          affectedPercentage: colProfile.outlierPercentage,
          recommendedAction: 'Verify if outliers are legitimate business values or anomalies.'
        });
        totalScore -= Math.min(10, outlierPercentage);
      }

      if (typeConsistencyPercentage < 100) {
        issues.push({
          severity: 'Critical',
          column: colName,
          issue: `Data type inconsistency (Expected ${colProfile.dataType})`,
          affectedRowCount: Math.round(((100 - typeConsistencyPercentage) / 100) * profile.totalRows),
          affectedPercentage: Math.round((100 - typeConsistencyPercentage) * 100) / 100,
          recommendedAction: 'Cleanse formatting or cast to a consistent type.'
        });
        totalScore -= 20;
      }

      if (invalidDateCount > 0) {
        issues.push({
          severity: 'Critical',
          column: colName,
          issue: 'Unparseable or invalid dates detected',
          affectedRowCount: colProfile.invalidDateCount,
          affectedPercentage: Math.round((invalidDateCount / sampleSize) * 10000) / 100,
          recommendedAction: 'Standardize date formatting.'
        });
        totalScore -= 15;
      }

      if (futureDateCount > 0) {
        issues.push({
          severity: 'Warning',
          column: colName,
          issue: 'Suspicious future dates detected',
          affectedRowCount: colProfile.futureDateCount,
          affectedPercentage: Math.round((futureDateCount / sampleSize) * 10000) / 100,
          recommendedAction: 'Verify if dates in the future are valid for this domain.'
        });
      }
      
      if (whitespaceCount > 0) {
         issues.push({
          severity: 'Warning',
          column: colName,
          issue: 'Whitespace-only strings detected',
          affectedRowCount: colProfile.whitespaceCount,
          affectedPercentage: Math.round((whitespaceCount / sampleSize) * 10000) / 100,
          recommendedAction: 'Trim or convert to NULL.'
        });
      }
    }

    profile.overallQualityScore = Math.max(0, Math.min(100, Math.round(totalScore)));
    if (profile.overallQualityScore >= 90) profile.qualityScoreCategory = 'Excellent';
    else if (profile.overallQualityScore >= 75) profile.qualityScoreCategory = 'Good';
    else if (profile.overallQualityScore >= 60) profile.qualityScoreCategory = 'Fair';
    else profile.qualityScoreCategory = 'Poor';

    // Sort issues by severity
    const severityRank = { Critical: 1, Warning: 2, Info: 3 };
    issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
    profile.issues = issues;

    return profile;
  }
}
