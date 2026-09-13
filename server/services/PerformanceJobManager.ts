import crypto from 'crypto';
import { Logger } from '../utils/logger';

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

export class PerformanceJobManager {
  private static instance: PerformanceJobManager;
  private activeJobs = new Map<string, PerformanceJobProgress>();
  private cancelledJobIds = new Set<string>();
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS_HISTORY = 100;

  private constructor() {
    // Periodically clean up completed jobs older than 10 minutes
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [jobId, job] of this.activeJobs.entries()) {
        if (job.completedAt && now - job.completedAt > 10 * 60 * 1000) {
          this.activeJobs.delete(jobId);
          this.cancelledJobIds.delete(jobId);
        }
      }
    }, 5 * 60 * 1000);
    interval.unref?.();
  }

  public static getInstance(): PerformanceJobManager {
    if (!PerformanceJobManager.instance) {
      PerformanceJobManager.instance = new PerformanceJobManager();
    }
    return PerformanceJobManager.instance;
  }

  public createJob(
    jobType: PerformanceJobProgress['jobType'],
    totalRows: number,
    totalSteps = 1,
    initialStepName = 'Initializing'
  ): PerformanceJobProgress {
    const jobId = `job_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = Date.now();
    const job: PerformanceJobProgress = {
      jobId,
      jobType,
      status: 'processing',
      stepNumber: 1,
      totalSteps,
      currentStepName: initialStepName,
      rowsProcessed: 0,
      totalRows: Math.max(totalRows, 1),
      speedRowsPerSec: 0,
      elapsedMs: 0,
      etaSeconds: 0,
      percent: 0,
      startedAt: now,
      updatedAt: now
    };
    this.activeJobs.set(jobId, job);
    return job;
  }

  public updateProgress(
    jobId: string,
    rowsProcessed: number,
    options: {
      stepNumber?: number;
      totalSteps?: number;
      currentStepName?: string;
      totalRows?: number;
      message?: string;
    } = {}
  ): PerformanceJobProgress | null {
    if (this.isCancelled(jobId)) {
      return null; // Signal caller to abort
    }

    const job = this.activeJobs.get(jobId);
    if (!job) return null;

    const now = Date.now();
    const elapsedMs = Math.max(now - job.startedAt, 1);
    const totalRows = options.totalRows !== undefined ? Math.max(options.totalRows, 1) : job.totalRows;

    const speedRowsPerSec = Math.round((rowsProcessed / (elapsedMs / 1000)));
    const remainingRows = Math.max(totalRows - rowsProcessed, 0);
    const etaSeconds = speedRowsPerSec > 0 ? Math.round(remainingRows / speedRowsPerSec) : 0;
    
    // Overall percent accounting for multi-step if available
    let percent = Math.min(Math.round((rowsProcessed / totalRows) * 100), 100);
    if (options.totalSteps && options.totalSteps > 1 && options.stepNumber) {
      const stepWeight = 100 / options.totalSteps;
      const completedStepsPercent = (options.stepNumber - 1) * stepWeight;
      const currentStepProgress = (rowsProcessed / totalRows) * stepWeight;
      percent = Math.min(Math.round(completedStepsPercent + currentStepProgress), 100);
    }

    job.rowsProcessed = rowsProcessed;
    job.totalRows = totalRows;
    job.speedRowsPerSec = speedRowsPerSec;
    job.elapsedMs = elapsedMs;
    job.etaSeconds = etaSeconds;
    job.percent = percent;
    job.updatedAt = now;
    if (options.stepNumber !== undefined) job.stepNumber = options.stepNumber;
    if (options.totalSteps !== undefined) job.totalSteps = options.totalSteps;
    if (options.currentStepName !== undefined) job.currentStepName = options.currentStepName;
    if (options.message !== undefined) job.message = options.message;

    return job;
  }

  public completeJob(jobId: string, message?: string): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      const now = Date.now();
      job.status = 'completed';
      job.percent = 100;
      job.rowsProcessed = job.totalRows;
      job.elapsedMs = now - job.startedAt;
      job.etaSeconds = 0;
      job.completedAt = now;
      job.message = message || 'Completed successfully.';
    }
  }

  public failJob(jobId: string, error: string): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      const now = Date.now();
      job.status = 'failed';
      job.error = error;
      job.completedAt = now;
      job.message = `Failed: ${error}`;
    }
  }

  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    this.cancelledJobIds.add(jobId);
    if (job) {
      job.status = 'cancelling';
      job.message = 'Cancellation requested...';
      job.updatedAt = Date.now();
      Logger.info('Performance job cancelled', { jobId, jobType: job.jobType });
      return true;
    }
    return false;
  }

  public markJobCancelled(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.status = 'cancelling';
      job.completedAt = Date.now();
      job.message = 'Cancelled by user.';
    }
  }

  public isCancelled(jobId?: string): boolean {
    if (!jobId) return false;
    return this.cancelledJobIds.has(jobId);
  }

  public getJob(jobId: string): PerformanceJobProgress | null {
    return this.activeJobs.get(jobId) || null;
  }

  public recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): PerformanceMetric {
    const memUsage = process.memoryUsage ? process.memoryUsage().heapUsed / (1024 * 1024) : undefined;
    const item: PerformanceMetric = {
      id: `m_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      peakMemoryMb: memUsage ? Math.round(memUsage * 10) / 10 : undefined,
      ...metric
    };
    this.metrics.unshift(item);
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics.pop();
    }
    return item;
  }

  public getMetrics(): PerformanceMetric[] {
    return this.metrics;
  }

  public clearMetrics(): void {
    this.metrics = [];
  }
}
