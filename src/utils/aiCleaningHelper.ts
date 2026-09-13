import { TransformStep, TransformType } from '../types/cleaning';
import { AiCleaningRecommendation } from '../types/aiCleaning';

/**
 * Converts an approved AI recommendation into a typed, non-destructive TransformStep for the pipeline.
 */
export function recommendationToTransformStep(rec: AiCleaningRecommendation): TransformStep {
  const params: Record<string, any> = { ...rec.suggestedParams };

  // Standardize params for DataCleaningEngine
  if (rec.transformationType === 'TEXT_CLEAN') {
    if (params.trimWhitespace !== undefined && params.trim === undefined) {
      params.trim = params.trimWhitespace;
    }
    if (params.collapseWhitespace !== undefined && params.collapseSpaces === undefined) {
      params.collapseSpaces = params.collapseWhitespace;
    }
  }

  if (rec.transformationType === 'REMOVE_DUPLICATES') {
    if (!params.columns && params.subsetColumns) {
      params.columns = params.subsetColumns;
    }
    if (!params.keep) {
      params.keep = 'first';
    }
  }

  return {
    id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: rec.transformationType,
    column: rec.column,
    description: rec.proposedTransformation || `${rec.transformationType.replace(/_/g, ' ')} on ${rec.column || 'table'}`,
    params,
    enabled: true,
    createdAt: new Date().toISOString(),
    validationStatus: 'valid',
    isAiRecommended: true,
    aiRecommendationId: rec.id
  };
}
