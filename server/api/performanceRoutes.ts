import { Router, Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';
import { PerformanceJobManager } from '../services/PerformanceJobManager';

export const performanceRoutes = Router();
const jobManager = PerformanceJobManager.getInstance();

/**
 * POST /api/performance/jobs
 * Creates a new tracked performance job
 */
performanceRoutes.post('/jobs', (req: Request, res: Response) => {
  try {
    const { jobType, totalRows, totalSteps, stepName } = req.body;
    if (!jobType) {
      ApiResponse.error(res, 400, 'MISSING_PARAM', 'jobType is required.');
      return;
    }

    const job = jobManager.createJob(
      jobType,
      Number(totalRows) || 1000,
      Number(totalSteps) || 1,
      stepName || 'Initializing'
    );

    res.json({
      success: true,
      job
    });
  } catch (err: any) {
    Logger.error('Failed to create performance job', err);
    ApiResponse.error(res, 500, 'JOB_CREATE_FAILED', err.message);
  }
});

/**
 * GET /api/performance/jobs/:jobId/status
 * Retrieves real-time status and throughput of a background job
 */
performanceRoutes.get('/jobs/:jobId/status', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = jobManager.getJob(jobId);
    if (!job) {
      ApiResponse.error(res, 404, 'JOB_NOT_FOUND', `Job '${jobId}' not found.`);
      return;
    }

    res.json({
      success: true,
      job
    });
  } catch (err: any) {
    Logger.error('Failed to fetch job status', err);
    ApiResponse.error(res, 500, 'JOB_STATUS_FAILED', err.message);
  }
});

/**
 * POST /api/performance/jobs/:jobId/cancel
 * Cancels a long-running job safely
 */
performanceRoutes.post('/jobs/:jobId/cancel', (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const cancelled = jobManager.cancelJob(jobId);
    if (!cancelled) {
      ApiResponse.error(res, 404, 'JOB_NOT_FOUND', `Job '${jobId}' not found or already finished.`);
      return;
    }

    res.json({
      success: true,
      message: `Job '${jobId}' cancellation requested.`
    });
  } catch (err: any) {
    Logger.error('Failed to cancel job', err);
    ApiResponse.error(res, 500, 'JOB_CANCEL_FAILED', err.message);
  }
});

/**
 * GET /api/performance/metrics
 * Returns execution duration and throughput metrics
 */
performanceRoutes.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = jobManager.getMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (err: any) {
    Logger.error('Failed to fetch metrics', err);
    ApiResponse.error(res, 500, 'METRICS_FAILED', err.message);
  }
});

/**
 * DELETE /api/performance/metrics
 * Clears metrics history
 */
performanceRoutes.delete('/metrics', (req: Request, res: Response) => {
  try {
    jobManager.clearMetrics();
    res.json({
      success: true,
      message: 'Metrics history cleared.'
    });
  } catch (err: any) {
    Logger.error('Failed to clear metrics', err);
    ApiResponse.error(res, 500, 'CLEAR_FAILED', err.message);
  }
});
