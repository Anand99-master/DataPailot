import { Router, Request, Response } from 'express';
import { AiAssistantService } from '../ai/AiAssistantService';
import { isGeminiConfigured, GEMINI_MODEL } from '../ai/geminiClient';
import { getSessionId } from './connectionRoutes';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';
import { AuditLogger } from '../utils/auditLogger';

export const aiRoutes = Router();

/**
 * GET /api/database/ai/status
 * Returns whether Gemini AI is configured on the server
 */
aiRoutes.get('/ai/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    configured: isGeminiConfigured(),
    model: GEMINI_MODEL
  });
});

/**
 * POST /api/database/ai/generate-sql
 * Translates natural language into verified read-only PostgreSQL SQL
 */
aiRoutes.post('/ai/generate-sql', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const sessionId = getSessionId(req, res);

  try {
    const { question, selectedTable, conversationHistory } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      ApiResponse.error(res, 400, 'INVALID_INPUT', 'Question is required.');
      return;
    }

    if (question.length > 5000) {
      ApiResponse.error(res, 400, 'PROMPT_TOO_LONG', 'Question exceeds 5,000 characters.');
      return;
    }

    const result = await AiAssistantService.generateSql({
      question: question.trim(),
      sessionId,
      selectedTable,
      conversationHistory
    });

    const durationMs = Date.now() - startTime;

    if (result.validationPassed && result.sql) {
      AuditLogger.record({
        type: 'AI_SQL_GENERATED',
        sessionId,
        status: 'success',
        durationMs,
        details: { tablesUsed: result.tablesUsed }
      });
      Logger.info('AI generated SQL query successfully', {
        sessionId,
        tablesUsed: result.tablesUsed,
        durationMs
      });
    } else {
      AuditLogger.record({
        type: 'AI_SQL_REJECTED',
        sessionId,
        status: 'failure',
        durationMs,
        details: { warnings: result.warnings }
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    AuditLogger.record({
      type: 'AI_SQL_REJECTED',
      sessionId,
      status: 'failure',
      durationMs,
      details: { error: err.message }
    });
    Logger.error('AI SQL generation failed', err, { sessionId, durationMs });
    ApiResponse.error(res, 400, 'AI_GENERATION_FAILED', err.message || 'Failed to generate SQL with AI.');
  }
});

/**
 * POST /api/database/ai/explain-sql
 * Provides simple and technical explanation of a SQL query
 */
aiRoutes.post('/ai/explain-sql', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req, res);
    const { sql } = req.body;

    if (!sql || typeof sql !== 'string' || !sql.trim()) {
      ApiResponse.error(res, 400, 'INVALID_INPUT', 'SQL query is required.');
      return;
    }

    const result = await AiAssistantService.explainSql(sql.trim(), sessionId);
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    Logger.error('AI SQL explanation failed', err);
    ApiResponse.error(res, 400, 'AI_EXPLAIN_FAILED', err.message || 'Failed to explain SQL query.');
  }
});

/**
 * POST /api/database/ai/explain-results
 * Explains query execution results based purely on returned data
 */
aiRoutes.post('/ai/explain-results', async (req: Request, res: Response) => {
  try {
    const { query, columns, rows, rowCount, executionTimeMs } = req.body;

    if (!query || !Array.isArray(columns) || !Array.isArray(rows)) {
      ApiResponse.error(res, 400, 'INVALID_INPUT', 'Query, columns, and rows are required.');
      return;
    }

    const result = await AiAssistantService.explainResults(
      query,
      columns,
      rows,
      rowCount ?? rows.length,
      executionTimeMs ?? 0
    );

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    Logger.error('AI results explanation failed', err);
    ApiResponse.error(res, 400, 'AI_EXPLAIN_FAILED', err.message || 'Failed to explain query results.');
  }
});

/**
 * POST /api/database/ai/fix-error
 * Diagnoses a query execution error and proposes a safe, schema-grounded fix
 */
aiRoutes.post('/ai/fix-error', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req, res);
    const { failedSql, errorMessage } = req.body;

    if (!failedSql || !errorMessage) {
      ApiResponse.error(res, 400, 'INVALID_INPUT', 'Failed SQL and error message are required.');
      return;
    }

    const result = await AiAssistantService.fixSqlError(failedSql, errorMessage, sessionId);
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    Logger.error('AI query fix failed', err);
    ApiResponse.error(res, 400, 'AI_FIX_FAILED', err.message || 'Failed to generate query fix.');
  }
});

/**
 * POST /api/database/ai/generate-dashboard
 * Generates an executive dashboard proposal with verified, schema-grounded widgets
 */
aiRoutes.post('/ai/generate-dashboard', async (req: Request, res: Response) => {
  const sessionId = getSessionId(req, res);
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      ApiResponse.error(res, 400, 'INVALID_INPUT', 'Dashboard prompt is required.');
      return;
    }

    const result = await AiAssistantService.generateDashboardPlan(prompt.trim(), sessionId);
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    Logger.error('AI dashboard generation failed', err, { sessionId });
    ApiResponse.error(res, 400, 'AI_DASHBOARD_FAILED', err.message || 'Failed to generate dashboard plan.');
  }
});

/**
 * POST /api/database/ai/dashboard-insights
 * Generates factual cross-widget insights based on actual displayed metrics
 */
aiRoutes.post('/ai/dashboard-insights', async (req: Request, res: Response) => {
  try {
    const { dashboardName, widgetSummaries } = req.body;

    if (!widgetSummaries || !Array.isArray(widgetSummaries)) {
      ApiResponse.error(res, 400, 'INVALID_INPUT', 'Widget summaries array is required.');
      return;
    }

    const result = await AiAssistantService.generateDashboardInsights(
      dashboardName || 'Executive Dashboard',
      widgetSummaries
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    Logger.error('AI dashboard insights failed', err);
    ApiResponse.error(res, 400, 'AI_INSIGHTS_FAILED', err.message || 'Failed to generate dashboard insights.');
  }
});

