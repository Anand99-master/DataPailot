import { TransformStep, CleaningPreviewResult, CleanedDatasetSaveResult } from '../types/cleaning';
import { AiCleaningPlan, AiReanalysisResult } from '../types/aiCleaning';
import { ExportFormat } from '../types/import';

export class CleaningApiClient {
  /**
   * Runs AI and Data Quality analysis to generate smart cleaning recommendations
   */
  public static async analyzeDatasetWithAi(
    datasetId: string,
    steps: TransformStep[] = []
  ): Promise<AiCleaningPlan> {
    const res = await fetch('/api/cleaning/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId, steps })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Failed to analyze dataset for AI recommendations.');
    }

    return data.plan;
  }

  /**
   * Re-analyzes dataset comparing before and after pipeline execution
   */
  public static async reanalyzeDatasetWithAi(
    datasetId: string,
    steps: TransformStep[] = []
  ): Promise<AiReanalysisResult> {
    const res = await fetch('/api/cleaning/ai/reanalyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId, steps })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Failed to re-analyze dataset.');
    }

    return data.result;
  }

  /**
   * Generates a preview of the dataset after applying the transformation steps
   */
  public static async previewPipeline(
    datasetId: string,
    steps: TransformStep[]
  ): Promise<CleaningPreviewResult> {
    const res = await fetch('/api/cleaning/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId, steps })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Failed to generate cleaning preview.');
    }

    return data.preview;
  }

  /**
   * Applies the transformation pipeline and saves the result as a new dataset in the Unified Data Layer
   */
  public static async saveCleanedDataset(
    datasetId: string,
    newDatasetName: string,
    steps: TransformStep[],
    pipelineMetadata?: { pipelineId?: string; pipelineName?: string; pipelineVersion?: number }
  ): Promise<CleanedDatasetSaveResult> {
    const res = await fetch('/api/cleaning/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId, newDatasetName, steps, pipelineMetadata })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Failed to save cleaned dataset.');
    }

    return data.result;
  }

  /**
   * Exports the cleaned data in CSV, JSON, or Excel format
   */
  public static async exportCleanedData(
    datasetId: string,
    steps: TransformStep[],
    format: ExportFormat,
    customName?: string
  ): Promise<void> {
    const res = await fetch('/api/cleaning/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId, steps, format, customName })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'Export failed');
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let fileName = `cleaned_dataset.${format}`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) fileName = match[1];
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
