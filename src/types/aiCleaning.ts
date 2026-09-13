import { TransformStep, TransformType } from './cleaning';
import { QualityIssue } from './import';

export type AiRecommendationConfidence = 'High' | 'Medium' | 'Low';
export type AiRecommendationRisk = 'Low' | 'Medium' | 'High';
export type AiRecommendationPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type AiRecommendationStatus = 'Pending' | 'Approved' | 'Rejected' | 'Applied';

export type AiRecommendationCategory =
  | 'missing'
  | 'duplicates'
  | 'types'
  | 'dates'
  | 'text'
  | 'numeric'
  | 'mapping'
  | 'outliers'
  | 'filter'
  | 'columns'
  | 'calculated'
  | 'conditional';

export interface SampleDiffItem {
  rowId?: number | string;
  originalValue: unknown;
  transformedValue: unknown;
  column?: string;
  description?: string;
}

export interface AiCleaningRecommendation {
  id: string;
  datasetId: string;
  column?: string;
  category: AiRecommendationCategory;
  priority: AiRecommendationPriority;
  problem: string; // What is wrong?
  why: string; // Why is it a problem?
  proposedTransformation: string; // What transformation is proposed?
  whatCouldChange: string; // What could change?
  transformationType: TransformType;
  suggestedParams: any; // Complete typed parameters for TransformStep
  confidence: AiRecommendationConfidence;
  confidenceScore: number; // 0-100 percentage
  confidenceReason: string; // Grounded explanation of confidence
  risk: AiRecommendationRisk;
  estimatedRowsAffected: number;
  sampleBefore: any[]; // Sample values before
  sampleAfter: any[]; // Sample values after
  potentialIssues?: string[];
  status: AiRecommendationStatus;
  createdAt: string;
  appliedStepId?: string;
}

export interface AiCleaningPlanStats {
  rows: number;
  columns: number;
  missingValuesCount: number;
  duplicatesCount: number;
  typeIssuesCount: number;
  dateIssuesCount: number;
  outliersCount: number;
}

export interface AiCleaningPlan {
  datasetId: string;
  datasetName: string;
  currentDqScore: number;
  estimatedDqScore: number; // Clearly labeled as estimate
  totalRecommendations: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  criticalIssuesCount: number;
  warningsCount: number;
  stats: AiCleaningPlanStats;
  recommendations: AiCleaningRecommendation[];
  aiAvailable: boolean;
  aiMode: 'gemini' | 'deterministic_fallback';
  analyzedAt: string;
  executionPlanOrder?: string[]; // Recommended ordered recommendation IDs
}

export interface AiRecommendationHistoryItem {
  recommendationId: string;
  datasetId: string;
  timestamp: string;
  problem: string;
  recommendation: string;
  confidence: AiRecommendationConfidence;
  status: AiRecommendationStatus;
}

export interface AiReanalysisResult {
  beforeDqScore: number;
  afterProposedEstimatedDqScore: number;
  actualDqScore?: number;
  resolvedIssues: string[];
  remainingIssues: QualityIssue[];
  newRecommendations: AiCleaningRecommendation[];
  plan: AiCleaningPlan;
}
