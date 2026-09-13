import { ColumnMetadata, DataProfile, FileType, ImportedDataset } from './import';

export type TransformType =
  | 'REMOVE_MISSING'
  | 'FILL_MISSING'
  | 'REMOVE_DUPLICATES'
  | 'CONVERT_TYPE'
  | 'STANDARDIZE_DATE'
  | 'TEXT_CLEAN'
  | 'NUMERIC_CLEAN'
  | 'MAP_VALUES'
  | 'HANDLE_OUTLIERS'
  | 'RENAME_COLUMN'
  | 'DROP_COLUMN'
  | 'DUPLICATE_COLUMN'
  | 'REORDER_COLUMNS'
  | 'SPLIT_COLUMN'
  | 'MERGE_COLUMNS'
  | 'EXTRACT_TEXT'
  | 'CALCULATED_COLUMN'
  | 'CONDITIONAL_COLUMN'
  | 'FILTER_ROWS'
  | 'SORT_ROWS'
  | 'RANK_ROWS'
  | 'DATE_EXTRACT'
  | 'DATE_DIFF'
  | 'PIVOT_TABLE'
  | 'UNPIVOT_TABLE';

export interface RemoveMissingParams {
  columns: string[]; // empty means all columns
  strategy: 'any' | 'all'; // remove row if any of these columns are missing, or all
}

export interface FillMissingParams {
  column: string;
  strategy: 'custom' | 'mean' | 'median' | 'mode' | 'zero' | 'ffill' | 'bfill';
  customValue?: string | number | boolean;
}

export interface RemoveDuplicatesParams {
  columns: string[]; // subset of columns for identity; empty = all columns
  keep: 'first' | 'last';
}

export interface ConvertTypeParams {
  column: string;
  targetType: 'integer' | 'numeric' | 'date' | 'boolean' | 'text';
  onInvalid: 'null' | 'keep';
}

export interface StandardizeDateParams {
  column: string;
  targetFormat: 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO';
}

export interface TextCleanParams {
  column: string;
  trim?: boolean;
  collapseSpaces?: boolean;
  caseTransform?: 'upper' | 'lower' | 'title' | 'none';
  findReplace?: { find: string; replace: string; matchCase?: boolean }[];
  standardizeValues?: { from: string[]; to: string }[];
}

export interface NumericCleanParams {
  column: string;
  removeCommas?: boolean;
  removeCurrency?: boolean;
  removePercentage?: boolean;
  handleNegative?: 'keep' | 'abs' | 'zero' | 'null';
}

export interface MapValuesParams {
  column: string;
  mappings: { from: string; to: string | null }[]; // string or null
}

export interface HandleOutliersParams {
  column: string;
  method: 'iqr' | 'zscore';
  action: 'remove' | 'cap';
  threshold?: number; // for zscore, default 3.0; for iqr, multiplier default 1.5
}

// --- 15.2 Advanced Data Transformation Interfaces ---

export interface RenameColumnParams {
  oldName: string;
  newName: string;
}

export interface DropColumnParams {
  columns: string[];
}

export interface DuplicateColumnParams {
  sourceColumn: string;
  newColumnName: string;
}

export interface ReorderColumnsParams {
  orderedColumns: string[];
}

export interface SplitColumnParams {
  column: string;
  delimiter: string;
  maxSplits?: number;
  newColumnNames: string[];
  keepOriginal?: boolean;
}

export interface MergeColumnsParams {
  columns: string[];
  delimiter: string;
  newColumnName: string;
  keepOriginal?: boolean;
}

export interface ExtractTextParams {
  column: string;
  mode: 'substring' | 'prefix' | 'suffix' | 'regex';
  start?: number;
  length?: number;
  delimiter?: string;
  count?: number;
  regexPattern?: string;
  newColumnName: string;
  replaceOriginal?: boolean;
}

export interface CalculatedColumnParams {
  newColumnName: string;
  expression: string;
  resultType?: 'numeric' | 'text' | 'boolean';
}

export interface ConditionalCondition {
  column: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'greater_equal'
    | 'less_equal'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'is_null'
    | 'is_not_null';
  value?: string | number | boolean;
}

export interface ConditionalRule {
  id: string;
  conditions: ConditionalCondition[];
  logic: 'AND' | 'OR';
  thenValue: string | number | boolean;
  thenType?: 'string' | 'number' | 'boolean' | 'null';
}

export interface ConditionalColumnParams {
  newColumnName: string;
  rules: ConditionalRule[];
  elseValue: string | number | boolean | null;
  elseType?: 'string' | 'number' | 'boolean' | 'null';
}

export interface FilterCondition {
  column: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'greater_equal'
    | 'less_equal'
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'is_null'
    | 'is_not_null'
    | 'between'
    | 'in_list';
  value?: string | number | boolean;
  value2?: string | number;
  valueList?: string[];
}

export interface FilterRowsParams {
  action: 'keep' | 'remove';
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
}

export interface SortLevel {
  column: string;
  direction: 'ASC' | 'DESC';
  nulls?: 'first' | 'last';
}

export interface SortRowsParams {
  levels: SortLevel[];
}

export interface RankRowsParams {
  measureColumn: string;
  targetColumnName: string;
  direction: 'ASC' | 'DESC';
  method: 'rank' | 'dense_rank' | 'row_number' | 'percentile';
  partitionBy?: string;
}

export type FilterOperator = FilterCondition['operator'];
export type ConditionItem = ConditionalCondition;
export type DateExtractPart = DateExtractParams['part'];
export type DateDiffUnit = DateDiffParams['unit'];
export type SortDirection = SortLevel['direction'];
export type RankMethod = RankRowsParams['method'];

export interface DateExtractParams {
  column: string;
  targetColumnName: string;
  part:
    | 'year'
    | 'quarter'
    | 'month_num'
    | 'month_name'
    | 'week'
    | 'day'
    | 'day_name'
    | 'day_of_week'
    | 'start_of_month'
    | 'end_of_month'
    | 'start_of_quarter'
    | 'end_of_quarter';
}

export interface DateDiffParams {
  startDateColumn: string;
  endDateColumn: string;
  targetColumnName: string;
  unit: 'days' | 'months' | 'years';
}

export interface PivotParams {
  rowColumns: string[];
  pivotColumn: string;
  valueColumn: string;
  aggregation: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';
}

export interface UnpivotParams {
  idColumns: string[];
  valueColumns: string[];
  attributeColumnName: string;
  valueColumnName: string;
}

export type StepParams =
  | RemoveMissingParams
  | FillMissingParams
  | RemoveDuplicatesParams
  | ConvertTypeParams
  | StandardizeDateParams
  | TextCleanParams
  | NumericCleanParams
  | MapValuesParams
  | HandleOutliersParams
  | RenameColumnParams
  | DropColumnParams
  | DuplicateColumnParams
  | ReorderColumnsParams
  | SplitColumnParams
  | MergeColumnsParams
  | ExtractTextParams
  | CalculatedColumnParams
  | ConditionalColumnParams
  | FilterRowsParams
  | SortRowsParams
  | RankRowsParams
  | DateExtractParams
  | DateDiffParams
  | PivotParams
  | UnpivotParams;

export interface TransformStep {
  id: string;
  type: TransformType;
  column?: string;
  description: string;
  params: any;
  enabled: boolean;
  createdAt: string;
  validationStatus?: 'valid' | 'warning' | 'invalid';
  validationMessage?: string;
  isAiRecommended?: boolean;
  aiRecommendationId?: string;
}

export interface StepExecutionMetric {
  stepId: string;
  stepNumber: number;
  stepType: TransformType;
  description: string;
  targetColumn?: string;
  enabled: boolean;
  rowsBefore: number;
  rowsAfter: number;
  rowsModified: number;
  rowsRemoved: number;
  colsBefore: number;
  colsAfter: number;
  columnsAdded: string[];
  columnsRemoved: string[];
  validationStatus: 'valid' | 'warning' | 'invalid';
  validationMessage?: string;
  executionStatus: 'success' | 'failed' | 'skipped';
  error?: string;
  durationMs: number;
}

export interface PipelineExecutionSummary {
  originalRows: number;
  finalRows: number;
  rowsModified: number;
  rowsRemoved: number;
  originalCols: number;
  finalCols: number;
  columnsAdded: number;
  columnsRemoved: number;
  dataQualityBefore: number;
  dataQualityAfter: number;
  totalTransformations: number;
  enabledSteps: number;
  disabledSteps: number;
  status: 'success' | 'warning' | 'failed' | 'idle';
  stepMetrics: StepExecutionMetric[];
  executionTimeMs: number;
  failedStepId?: string;
  failedStepReason?: string;
}

export interface PipelineVersionSnapshot {
  version: number;
  name: string;
  description?: string;
  steps: TransformStep[];
  updatedAt: string;
}

export interface SavedPipeline {
  id: string;
  name: string;
  description?: string;
  sourceDatasetId?: string;
  sourceDatasetName?: string;
  version: number;
  versions?: PipelineVersionSnapshot[];
  steps: TransformStep[];
  requiredColumns: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DatasetCompatibilityResult {
  isCompatible: boolean;
  status: 'fully_compatible' | 'partially_compatible' | 'incompatible';
  missingColumns: string[];
  matchedColumns: string[];
  typeMismatches: { column: string; expected: string; actual: string }[];
  possibleMatches: { missing: string; candidate: string }[];
  warnings: string[];
}

export interface StepValidationResult {
  stepId: string;
  status: 'valid' | 'warning' | 'invalid';
  message: string;
  affectedColumns?: string[];
}

export interface PipelineValidationResult {
  isValid: boolean;
  stepValidations: StepValidationResult[];
  errors: string[];
  warnings: string[];
}

export type CleaningTabId =
  | 'overview'
  | 'ai-assistant'
  | 'columns'
  | 'calculated'
  | 'conditional'
  | 'filter'
  | 'sort-rank'
  | 'date-transforms'
  | 'pivot-unpivot'
  | 'missing'
  | 'duplicates'
  | 'types'
  | 'dates'
  | 'text'
  | 'numeric'
  | 'mapping'
  | 'outliers'
  | 'pipeline'
  | 'preview';

export interface CellChange {
  rowIndex: number;
  column: string;
  original: unknown;
  cleaned: unknown;
}

export interface CleaningPreviewResult {
  originalRows: Record<string, unknown>[];
  cleanedRows: Record<string, unknown>[];
  columns: ColumnMetadata[];
  totalOriginalRows: number;
  totalCleanedRows: number;
  affectedRowCount: number;
  affectedColumnCount: number;
  changedCells: CellChange[];
  modifiedRowIndices?: number[];
  removedRows?: number;
  qualityBefore?: DataProfile;
  qualityAfter?: DataProfile;
  executionTimeMs: number;
  summary?: PipelineExecutionSummary;
  stepMetrics?: StepExecutionMetric[];
  invalidConversions?: { rowIndex: number; column: string; rawValue: unknown; reason: string }[];
}

export interface CleanedDatasetSaveResult {
  originalDatasetId: string;
  newDataset: ImportedDataset;
  stepsApplied: number;
  message: string;
  lineage?: {
    sourceDatasetId: string;
    sourceDatasetName: string;
    pipelineId?: string;
    pipelineName?: string;
    pipelineVersion?: number;
    stepsCount: number;
    createdAt: string;
  };
}
