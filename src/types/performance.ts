export interface PlanNode {
  "Node Type": string;
  "Startup Cost"?: number;
  "Total Cost"?: number;
  "Plan Rows"?: number;
  "Plan Width"?: number;
  "Relation Name"?: string;
  "Alias"?: string;
  "Filter"?: string;
  "Join Type"?: string;
  "Index Name"?: string;
  "Hash Cond"?: string;
  "Plans"?: PlanNode[];
  [key: string]: any;
}

export interface ExplainResult {
  Plan: PlanNode;
}

export interface PerformanceAnalysis {
  id: string;
  query: string;
  timestamp: string;
  plan: PlanNode;
  summary: {
    totalCost: number;
    startupCost: number;
    rows: number;
    primaryScan: string;
    indexUsed: boolean;
    joins: number;
    sort: boolean;
  };
  warnings: string[];
  indexes?: IndexInfo[];
}

export interface IndexInfo {
  tableName: string;
  indexName: string;
  columns: string[];
  isUnique: boolean;
}
