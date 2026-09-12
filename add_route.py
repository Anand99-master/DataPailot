with open('server/api/queryRoutes.ts', 'r') as f:
    c = f.read()

import_stmt = "import { AnalysisSqlGenerator } from '../database/AnalysisSqlGenerator';\n"
if import_stmt not in c:
    c = import_stmt + c

route_code = """
/**
 * POST /api/database/analysis/generate
 * Dynamically generates analysis SQL queries using the active dialect
 */
queryRoutes.post('/analysis/generate', async (req: Request, res: Response) => {
  const sessionId = getSessionId(req, res);
  try {
    const adapter = connectionManager.getAdapter(sessionId);
    if (!adapter || !adapter.isConnected()) {
      ApiResponse.error(res, 400, 'NOT_CONNECTED', 'No active database connection.');
      return;
    }
    
    const dialect = adapter.getDialect();
    const generator = new AnalysisSqlGenerator(dialect);
    
    const { method, args } = req.body;
    if (typeof (generator as any)[method] !== 'function') {
      ApiResponse.error(res, 400, 'INVALID_METHOD', `Method ${method} not found`);
      return;
    }
    
    const result = (generator as any)[method](...args);
    res.json({ success: true, result });
  } catch (err: any) {
    Logger.error('Error generating analysis query', err, { sessionId });
    ApiResponse.error(res, 500, 'GENERATION_ERROR', err.message);
  }
});
"""

if "/analysis/generate" not in c:
    c = c + route_code

with open('server/api/queryRoutes.ts', 'w') as f:
    f.write(c)
