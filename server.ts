import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { connectionRoutes } from './server/api/connectionRoutes';
import { schemaRoutes } from './server/api/schemaRoutes';
import { queryRoutes } from './server/api/queryRoutes';
import { aiRoutes } from './server/api/aiRoutes';
import { importRoutes } from './server/api/importRoutes';
import { qualityRoutes } from './server/api/qualityRoutes';
import { isGeminiConfigured, GEMINI_MODEL } from './server/ai/geminiClient';
import { ConnectionManager } from './server/database/ConnectionManager';
import { Logger } from './server/utils/logger';
import { AuditLogger } from './server/utils/auditLogger';

function validateStartupConfiguration() {
  Logger.info('Validating DataPilot startup configuration...', {
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development'
  });

  const aiReady = isGeminiConfigured();
  if (aiReady) {
    Logger.info('Gemini AI Assistant is configured and operational', { model: GEMINI_MODEL });
  } else {
    Logger.warn(
      'Gemini AI Assistant is not configured (GEMINI_API_KEY environment secret is not set). Read-only analytical SQL execution and schema introspection remain fully operational.'
    );
  }
}

async function startServer() {
  validateStartupConfiguration();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Health check route conforming to requirement 33
  app.get('/api/health', (_req, res) => {
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      service: 'DataPilot Backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024)
      },
      ai: {
        configured: isGeminiConfigured(),
        model: GEMINI_MODEL
      },
      database: {
        engine: 'postgresql',
        mode: 'strict-read-only',
        activeSessions: ConnectionManager.getInstance().getActiveSessionCount()
      }
    });
  });

  // Audit events route for verification & diagnostics (no secrets returned)
  app.get('/api/audit/recent', (_req, res) => {
    res.json({
      success: true,
      events: AuditLogger.getRecentEvents(50)
    });
  });

  // Database & Import API routes
  app.use('/api/database', connectionRoutes);
  app.use('/api/database', schemaRoutes);
  app.use('/api/database', queryRoutes);
  app.use('/api/database', aiRoutes);
  app.use('/api/quality', qualityRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/database/import', importRoutes);

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Safe global error handler: Never leaks stack traces or filesystem paths
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    Logger.error('Unhandled internal server error', err);
    res.status(500).json({
      success: false,
      error: 'An internal server error occurred.',
      errorDetails: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred. Please retry your request.'
      }
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DataPilot server running on http://localhost:${PORT}`);
  });
}

startServer();
