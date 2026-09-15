import { DiscoveredTable, TableColumnInfo, TableDetailsResult, QueryResult } from './database';

export type DataSourceType = 'DATABASE' | 'FILE';
export type FileType = 'CSV' | 'XLSX' | 'JSON';
export type ImportStatus = 'idle' | 'uploading' | 'processing' | 'validating' | 'ready' | 'failed';
export type ExportFormat = 'csv' | 'json' | 'xlsx';

export interface ColumnMetadata {
  name: string;
  dataType: 'text' | 'integer' | 'numeric' | 'boolean' | 'date' | 'timestamp' | 'unknown';
  originalType?: string;
  isNullable: boolean;
  nullCount: number;
  sampleValues: unknown[];
}

export interface NumericDistribution {
  min: number;
  q25: number;
  median: number;
  q75: number;
  max: number;
  avg: number;
  zeroCount: number;
}

export interface ColumnProfile {
  columnName: string;
  dataType: string;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  min?: number | string | null;
  max?: number | string | null;
  average?: number | null;
  median?: number | null;
  standardDeviation?: number | null;
  shortestLength?: number | null;
  longestLength?: number | null;
  earliestDate?: string | null;
  latestDate?: string | null;
  numericDistribution?: NumericDistribution;
  sampleValues: unknown[];
  
  // Phase 14: Data Quality & Profiling 2.0
  missingCount?: number;
  missingPercentage?: number;
  emptyStringCount?: number;
  whitespaceCount?: number;
  duplicateCount?: number;
  duplicatePercentage?: number;
  outlierCount?: number;
  outlierPercentage?: number;
  typeConsistencyPercentage?: number;
  invalidDateCount?: number;
  futureDateCount?: number;
  zeroCount?: number;
  negativeCount?: number;
  qualityStatus?: 'Good' | 'Warning' | 'Critical';
  
  // Phase 15.6: Large Dataset Profiling
  isEstimated?: boolean;
  estimateNote?: string;
}

export interface QualityIssue {
  severity: 'Critical' | 'Warning' | 'Info';
  column: string;
  issue: string;
  affectedRowCount: number;
  affectedPercentage: number;
  recommendedAction: string;
  sampleValues?: unknown[];
}

export interface DataProfile {
  datasetId: string;
  datasetName: string;
  totalRows: number;
  totalColumns: number;
  profiledAt: string;
  columns: Record<string, ColumnProfile>;
  
  // Phase 14: Data Quality & Profiling 2.0
  overallQualityScore?: number;
  qualityScoreCategory?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  issues?: QualityIssue[];
  duplicateRowCount?: number;
  duplicateRowPercentage?: number;

  // Phase 15.6: Large Dataset Performance Profiling
  rowsAnalyzed?: number;
  rowsSampled?: number;
  isSampled?: boolean;
  samplePercentage?: number;
  analysisMode?: 'Exact' | 'Sampled';
}

export interface DataPreview {
  datasetId: string;
  datasetName: string;
  fileType: FileType;
  rowCount: number;
  totalRows?: number;
  columnCount: number;
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  previewRowCount: number;
}

export interface ImportedDataset {
  datasetId: string;
  workspaceId?: string;
  sourceType: DataSourceType;
  sourceName: string;
  fileType: FileType;
  rowCount: number;
  columns: ColumnMetadata[];
  schema: string;
  name: string;
  tableName: string;
  previewRows: Record<string, unknown>[];
  importTimestamp: string;
  status: ImportStatus;
  sheets?: string[];
  selectedSheet?: string;
  fileSize?: number;
  profile?: DataProfile;
  error?: string;
}

export interface DataSource {
  id: string;
  type: DataSourceType;
  name: string;
  description?: string;
  status: 'ready' | 'loading' | 'error' | 'uploading' | 'processing' | 'validating' | 'failed';
  fileType?: FileType;
  fileSize?: number;
  rowCount?: number;
  columnCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OperationSupportStatus {
  operation: string;
  category: string;
  status: 'SUPPORTED' | 'UNSUPPORTED' | 'NOT APPLICABLE';
  reason?: string;
}

export interface ImportValidationResult {
  isValid: boolean;
  fileType?: FileType;
  fileName: string;
  fileSize: number;
  rowCount?: number;
  columnCount?: number;
  sheets?: string[];
  selectedSheet?: string;
  columns?: ColumnMetadata[];
  previewRows?: Record<string, unknown>[];
  error?: string;
  warnings?: string[];
}
