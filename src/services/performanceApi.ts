export interface PerformanceJobProgress {
  jobId: string;
  jobType: 'import' | 'transform' | 'quality' | 'export';
  status: 'idle' | 'preparing' | 'processing' | 'cancelling' | 'completed' | 'failed';
  stepNumber?: number;
  totalSteps?: number;
  currentStepName?: string;
  rowsProcessed: number;
  totalRows: number;
  speedRowsPerSec: number;
  elapsedMs: number;
  etaSeconds: number;
  percent: number;
  message?: string;
  error?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface PerformanceMetric {
  id: string;
  operation: string;
  datasetId?: string;
  rowCount: number;
  durationMs: number;
  rowsPerSecond: number;
  strategyUsed: string;
  peakMemoryMb?: number;
  timestamp: string;
}

export class PerformanceApiClient {
  private static baseUrl = '/api/performance';

  public static async createJob(
    jobType: 'import' | 'transform' | 'quality' | 'export',
    totalRows: number,
    totalSteps = 1,
    stepName = 'Initializing'
  ): Promise<PerformanceJobProgress> {
    const res = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobType, totalRows, totalSteps, stepName })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to create performance job.');
    }
    return data.job;
  }

  public static async getJobStatus(jobId: string): Promise<PerformanceJobProgress> {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}/status`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to retrieve job status.');
    }
    return data.job;
  }

  public static async cancelJob(jobId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}/cancel`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to cancel job.');
    }
  }

  public static async getMetrics(): Promise<PerformanceMetric[]> {
    const res = await fetch(`${this.baseUrl}/metrics`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to retrieve metrics.');
    }
    return data.metrics;
  }

  public static async clearMetrics(): Promise<void> {
    await fetch(`${this.baseUrl}/metrics`, { method: 'DELETE' });
  }
}
