import { DiscoveredTable, TableColumnInfo, DatabaseRelationship } from './database';

export type AnalysisCategory =
  | 'BASIC'
  | 'FILTERING'
  | 'AGGREGATION'
  | 'GROUPING'
  | 'JOIN'
  | 'CALCULATIONS'
  | 'DATE_ANALYSIS'
  | 'RANKING'
  | 'WINDOW_FUNCTIONS'
  | 'CUSTOM_COLUMNS'
  | 'CUSTOMER_ANALYSIS'
  | 'SALES_ANALYSIS'
  | 'PRODUCT_ANALYSIS'
  | 'DATA_QUALITY'
  | 'ADVANCED_ANALYTICS';

export interface FilterCondition {
  id: string;
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'IN' | 'NOT IN' | 'BETWEEN' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';
  value: string;
  value2?: string; // for BETWEEN
  logic: 'AND' | 'OR';
}

export interface AggregationItem {
  id: string;
  func: 'COUNT' | 'COUNT DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  column: string;
  alias: string;
}

export interface HavingCondition {
  enabled: boolean;
  func: 'COUNT' | 'COUNT DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=';
  value: string;
}

export interface CaseRule {
  id: string;
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE';
  value: string;
  resultLabel: string;
}

export interface CaseCategoryConfig {
  column: string;
  rules: CaseRule[];
  fallbackLabel: string;
  alias: string;
}

export interface CalculatedColumnConfig {
  col1: string;
  operator: '+' | '-' | '*' | '/';
  col2: string;
  alias: string;
}

export interface DateAnalysisConfig {
  dateColumn: string;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  measureColumn: string;
  measureFunction: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';
  mode: 'trend' | 'mom' | 'yoy' | 'running_sum' | 'running_count' | 'rolling_avg';
  rollingWindow?: number;
}

export interface WindowFunctionConfig {
  func:
    | 'ROW_NUMBER'
    | 'RANK'
    | 'DENSE_RANK'
    | 'NTILE'
    | 'LAG'
    | 'LEAD'
    | 'FIRST_VALUE'
    | 'LAST_VALUE'
    | 'SUM OVER'
    | 'AVG OVER'
    | 'COUNT OVER';
  partitionColumns: string[];
  orderColumn: string;
  orderDirection: 'ASC' | 'DESC';
  targetColumn?: string;
  ntileBuckets?: number;
  offset?: number;
  alias: string;
}

export interface TopNPerGroupConfig {
  groupColumn: string;
  rankingColumn: string;
  n: number;
  direction: 'DESC' | 'ASC';
  rankingMethod: 'DENSE_RANK' | 'ROW_NUMBER' | 'RANK';
}

export interface MultiTableJoinConfig {
  baseTable: { schema: string; name: string };
  joinTable: { schema: string; name: string };
  joinType: 'INNER JOIN' | 'LEFT JOIN' | 'RIGHT JOIN' | 'FULL JOIN';
  baseColumn: string;
  joinColumn: string;
  isConfirmedRelationship: boolean;
  confirmedConstraintName?: string;
  isManualOverride?: boolean;
  selectedColumns: {
    tableKey: 'base' | 'join';
    tableName: string;
    column: string;
    alias?: string;
  }[];
}

export interface FunnelStep {
  id: string;
  name: string;
  eventValue: string;
}

export interface FunnelConfig {
  userIdColumn: string;
  eventColumn: string;
  timestampColumn: string;
  steps: FunnelStep[];
}

export interface CohortConfig {
  userIdColumn: string;
  firstActivityDateColumn: string;
  activityDateColumn: string;
  measureColumn?: string;
}

export interface RetentionConfig {
  userIdColumn: string;
  firstActivityDateColumn: string;
  returnDateColumn: string;
  periodUnit: 'day' | 'week' | 'month';
}

export interface AnalysisHistoryItem {
  id: string;
  name: string;
  category: AnalysisCategory;
  tables: string[];
  columns: string[];
  sql: string;
  timestamp: string;
  summary: string;
}

export interface GeneratedAnalysisQuery {
  name: string;
  title?: string;
  category: AnalysisCategory;
  description: string;
  tablesUsed: string[];
  columnsUsed: string[];
  sql: string;
  suggestedLimit?: number;
}
