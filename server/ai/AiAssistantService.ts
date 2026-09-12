import { getGeminiClient, isGeminiConfigured, generateContentWithFallback } from './geminiClient';
import { SchemaContextService } from './SchemaContextService';
import { SchemaValidator } from './SchemaValidator';
import { QuerySafetyValidator } from '../database/QuerySafetyValidator';
import { ConnectionManager } from '../database/ConnectionManager';

export interface SqlGenerationRequest {
  question: string;
  sessionId: string;
  selectedTable?: { schema: string; name: string };
  conversationHistory?: {
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
  }[];
}

export interface SqlGenerationResponse {
  understanding: string;
  sql: string;
  tablesUsed: string[];
  explanation: string;
  assumptions: string[];
  warnings: string[];
  clarificationNeeded?: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
  validationPassed: boolean;
}

export interface ExplainSqlResponse {
  simpleExplanation: string;
  technicalExplanation: string;
  tablesUsed: string[];
  joins: string[];
  filters: string[];
  aggregations: string[];
  sortingAndGrouping: string[];
}

export interface ExplainResultsResponse {
  summary: string;
  keyInsights: string[];
  dataTrends: string[];
  rowCount: number;
}

export interface FixSqlErrorResponse {
  originalSql: string;
  errorMessage: string;
  suggestedSql: string;
  explanation: string;
  tablesUsed: string[];
  assumptions: string[];
  warnings: string[];
  validationPassed: boolean;
}

export class AiAssistantService {
  /**
  * Generates schema-aware read-only SQL from natural language
   */
  public static async generateSql(request: SqlGenerationRequest): Promise<SqlGenerationResponse> {
    if (!isGeminiConfigured()) {
      throw new Error(
        'AI service is not configured. Please set the GEMINI_API_KEY environment secret in the Settings panel.'
      );
    }

    const adapter = ConnectionManager.getInstance().getAdapter(request.sessionId);
    if (!adapter || !adapter.isConnected()) {
      throw new Error('Database is not connected. Please connect to a database first to ask questions about your data.');
    }

    // 1. Retrieve verified schema context from the live database
    const schemaContext = await SchemaContextService.buildContext(
      adapter,
      request.question,
      request.selectedTable
    );

    if (schemaContext.tables.length === 0) {
      return {
        understanding: 'Database schema contains no accessible tables.',
        sql: '',
        tablesUsed: [],
        explanation: 'No tables were found in the connected database.',
        assumptions: [],
        warnings: ['Database has no accessible user tables.'],
        validationPassed: false
      };
    }

    const ai = getGeminiClient();
    if (!ai) {
      throw new Error('AI client could not be initialized.');
    }

    // Maximum 2 attempts (initial + 1 schema/safety retry if needed)
    let currentAttempt = 0;
    let retryFeedback = '';

    while (currentAttempt < 2) {
      currentAttempt++;

      const prompt = this.buildSqlGenerationPrompt(
        request.question,
        schemaContext.formattedPromptContext,
        schemaContext.databaseType,
        request.conversationHistory,
        retryFeedback
      );

      const response = await generateContentWithFallback({
        contents: prompt,
        config: {
          temperature: 0.1, // low temperature for precise SQL generation
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '';
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        // Fallback cleanup if model wrapped in markdown fences
        const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      // Check if clarification is needed
      if (parsed.clarificationNeeded) {
        return {
          understanding: parsed.understanding || request.question,
          sql: '',
          tablesUsed: [],
          explanation: parsed.explanation || 'Clarification needed.',
          assumptions: [],
          warnings: parsed.warnings || [],
          clarificationNeeded: true,
          clarificationQuestion: parsed.clarificationQuestion || 'Could you clarify which metric you would like to analyze?',
          clarificationOptions: Array.isArray(parsed.clarificationOptions) ? parsed.clarificationOptions : [],
          validationPassed: true
        };
      }

      const generatedSql = (parsed.sql || '').trim();

      // Check if the model determined required fields are missing
      if (!generatedSql) {
        return {
          understanding: parsed.understanding || request.question,
          sql: '',
          tablesUsed: [],
          explanation: parsed.explanation || 'Cannot formulate query with available schema.',
          assumptions: parsed.assumptions || [],
          warnings: parsed.warnings || [
            'I cannot calculate this reliably because the connected database does not contain the required fields.'
          ],
          validationPassed: false
        };
      }

      // Safety check (strictly read-only analytical SQL)
      const safetyResult = QuerySafetyValidator.validate(generatedSql);
      if (!safetyResult.isValid) {
        if (currentAttempt < 2) {
          retryFeedback = `SECURITY REJECTION: The generated SQL was rejected by the safety validator: ${safetyResult.error}. You MUST generate only read-only single-statement SELECT or WITH queries.`;
          continue;
        } else {
          return {
            understanding: parsed.understanding || request.question,
            sql: generatedSql,
            tablesUsed: parsed.tablesUsed || [],
            explanation: parsed.explanation || '',
            assumptions: parsed.assumptions || [],
            warnings: [`Safety validation failed: ${safetyResult.error}`],
            validationPassed: false
          };
        }
      }

      // Schema check (strictly real tables and columns)
      const schemaValidation = SchemaValidator.validate(generatedSql, schemaContext.tables);
      if (!schemaValidation.isValid) {
        if (currentAttempt < 2) {
          retryFeedback = `SCHEMA MISMATCH: ${schemaValidation.details}. You MUST use only verified tables and columns present in the schema context. Do not invent identifiers.`;
          continue;
        } else {
          return {
            understanding: parsed.understanding || request.question,
            sql: generatedSql,
            tablesUsed: parsed.tablesUsed || [],
            explanation: parsed.explanation || '',
            assumptions: parsed.assumptions || [],
            warnings: [`Schema validation warning: ${schemaValidation.details}`],
            validationPassed: false
          };
        }
      }

      // All validations passed
      return {
        understanding: parsed.understanding || request.question,
        sql: generatedSql,
        tablesUsed: Array.isArray(parsed.tablesUsed) ? parsed.tablesUsed : [],
        explanation: parsed.explanation || 'Generated a read-only query matching your question.',
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        validationPassed: true
      };
    }

    throw new Error('Could not generate a valid query matching the database schema.');
  }

  /**
   * Explains SQL query in both simple and technical terms
   */
  public static async explainSql(sql: string, sessionId: string): Promise<ExplainSqlResponse> {
    if (!isGeminiConfigured()) {
      throw new Error('AI service is not configured.');
    }

    const adapter = ConnectionManager.getInstance().getAdapter(sessionId);
    const dialect = adapter?.type || 'the connected database';
    const ai = getGeminiClient();
    if (!ai) throw new Error('AI client could not be initialized.');

    // Safety check first
    const safety = QuerySafetyValidator.validate(sql);
    if (!safety.isValid) {
      throw new Error(`Invalid query: ${safety.error}`);
    }

    const prompt = `
You are DataPilot AI, an expert ${dialect} database analyst.
Analyze the following SQL query and explain it clearly.

SQL QUERY:
\`\`\`sql
${sql}
\`\`\`

Return a JSON object conforming to this exact structure:
{
  "simpleExplanation": "Clear, plain-English explanation for a beginner or business user explaining what business question this answers and what the output shows.",
  "technicalExplanation": "Detailed technical breakdown explaining the query structure, execution mechanics, and optimization aspects for the connected database dialect.",
  "tablesUsed": ["table1", "table2"],
  "joins": ["JOIN type and conditions, or 'None'"],
  "filters": ["WHERE/HAVING conditions applied, or 'None'"],
  "aggregations": ["Aggregations performed (SUM, COUNT, etc.), or 'None'"],
  "sortingAndGrouping": ["GROUP BY and ORDER BY clauses, or 'None'"]
}
`;

    const response = await generateContentWithFallback({
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });

    try {
      const parsed = JSON.parse(response.text || '{}');
      return {
        simpleExplanation: parsed.simpleExplanation || 'This query extracts data from the database.',
        technicalExplanation: parsed.technicalExplanation || 'Standard read-only query execution for the connected database.',
        tablesUsed: Array.isArray(parsed.tablesUsed) ? parsed.tablesUsed : [],
        joins: Array.isArray(parsed.joins) ? parsed.joins : [],
        filters: Array.isArray(parsed.filters) ? parsed.filters : [],
        aggregations: Array.isArray(parsed.aggregations) ? parsed.aggregations : [],
        sortingAndGrouping: Array.isArray(parsed.sortingAndGrouping) ? parsed.sortingAndGrouping : []
      };
    } catch {
      throw new Error('Failed to parse explanation from AI.');
    }
  }

  /**
   * Explains the execution results strictly based on returned data
   */
  public static async explainResults(
    query: string,
    columns: { name: string; type?: string }[],
    rows: any[],
    rowCount: number,
    executionTimeMs: number
  ): Promise<ExplainResultsResponse> {
    if (!isGeminiConfigured()) {
      throw new Error('AI service is not configured.');
    }

    const ai = getGeminiClient();
    if (!ai) throw new Error('AI client could not be initialized.');

    // Cost / Token control: Sample up to 40 rows and summarize
    const sampleRows = rows.slice(0, 40);

    const prompt = `
You are DataPilot AI, a senior data analyst.
Explain the returned query results objectively and accurately.

CRITICAL RULES:
1. Base your explanation and insights ONLY on the real numbers and rows provided below.
2. NEVER invent numbers, metrics, or facts not present in this dataset.
3. Be concise, direct, and actionable.

QUERY:
${query}

METRICS:
- Total Returned Rows: ${rowCount}
- Query Execution Time: ${executionTimeMs}ms
- Columns: ${columns.map(c => `${c.name} (${c.type || 'unknown'})`).join(', ')}

SAMPLE DATA (${sampleRows.length} of ${rowCount} rows):
${JSON.stringify(sampleRows, null, 2)}

Return a JSON object conforming to this exact structure:
{
  "summary": "1-2 sentence high-level overview of what the query returned and the primary conclusion.",
  "keyInsights": [
    "Specific factual insight #1 citing actual numbers from the rows",
    "Specific factual insight #2 citing actual numbers from the rows",
    "Specific factual insight #3 citing actual numbers from the rows"
  ],
  "dataTrends": [
    "Notable patterns or distributions observed in the data"
  ]
}
`;

    const response = await generateContentWithFallback({
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    try {
      const parsed = JSON.parse(response.text || '{}');
      return {
        summary: parsed.summary || `Returned ${rowCount} rows in ${executionTimeMs}ms.`,
        keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
        dataTrends: Array.isArray(parsed.dataTrends) ? parsed.dataTrends : [],
        rowCount
      };
    } catch {
      throw new Error('Failed to parse results explanation from AI.');
    }
  }

  /**
   * Fixes a failed SQL query using database schema and PostgreSQL error message
   */
  public static async fixSqlError(
    failedSql: string,
    errorMessage: string,
    sessionId: string
  ): Promise<FixSqlErrorResponse> {
    if (!isGeminiConfigured()) {
      throw new Error('AI service is not configured.');
    }

    const adapter = ConnectionManager.getInstance().getAdapter(sessionId);
    if (!adapter || !adapter.isConnected()) {
      throw new Error('Database is not connected.');
    }

    const schemaContext = await SchemaContextService.buildContext(adapter, failedSql);
    const ai = getGeminiClient();
    if (!ai) throw new Error('AI client could not be initialized.');

    const prompt = `
  You are DataPilot AI, an expert ${schemaContext.databaseType} database analyst.
A user query failed with an execution error. Fix the query using the VERIFIED DATABASE SCHEMA.

${schemaContext.formattedPromptContext}

FAILED SQL:
\`\`\`sql
${failedSql}
\`\`\`

DATABASE ERROR MESSAGE:
"${errorMessage}"

RULES:
1. Fix syntax, missing columns, invalid tables, or incorrect JOINs/GROUP BYs.
2. Use ONLY real tables and columns present in the schema context.
3. The query MUST be read-only (SELECT or WITH).
4. Do not invent columns or tables.

Return a JSON object conforming to this exact structure:
{
  "suggestedSql": "SELECT ...",
  "explanation": "Clear explanation of what was wrong and how the fix corrects it.",
  "tablesUsed": ["table1"],
  "assumptions": [],
  "warnings": []
}
`;

    const response = await generateContentWithFallback({
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    try {
      const parsed = JSON.parse(response.text || '{}');
      const suggestedSql = (parsed.suggestedSql || '').trim();

      const safety = QuerySafetyValidator.validate(suggestedSql);
      const schemaCheck = SchemaValidator.validate(suggestedSql, schemaContext.tables);

      const isValid = safety.isValid && schemaCheck.isValid;
      const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
      if (!safety.isValid && safety.error) warnings.push(safety.error);
      if (!schemaCheck.isValid && schemaCheck.details) warnings.push(schemaCheck.details);

      return {
        originalSql: failedSql,
        errorMessage,
        suggestedSql,
        explanation: parsed.explanation || 'Corrected SQL based on database schema.',
        tablesUsed: Array.isArray(parsed.tablesUsed) ? parsed.tablesUsed : [],
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
        warnings,
        validationPassed: isValid
      };
    } catch {
      throw new Error('Failed to generate fix for the query.');
    }
  }

  /**
   * Builds the prompt for natural language to SQL generation
   */
  private static buildSqlGenerationPrompt(
    question: string,
    schemaText: string,
    dialect: string,
    history?: { role: string; content: string; sql?: string }[],
    retryFeedback?: string
  ): string {
    let historyText = '';
    if (history && history.length > 0) {
      historyText = '### RECENT CONVERSATION HISTORY (FOR CONTEXT & FOLLOW-UPS):\n';
      // Take last 5 history items
      for (const item of history.slice(-5)) {
        historyText += `${item.role.toUpperCase()}: ${item.content}\n`;
        if (item.sql) {
          historyText += `GENERATED_SQL: ${item.sql}\n`;
        }
      }
      historyText += '\n';
    }

    let retryText = '';
    if (retryFeedback) {
      retryText = `\n### CORRECTION FEEDBACK FROM PREVIOUS ATTEMPT:\n${retryFeedback}\n`;
    }

    const dialectRules: Record<string, string> = {
      postgresql: 'Use PostgreSQL syntax and LIMIT/OFFSET where appropriate.',
      mysql: 'Use MySQL syntax and LIMIT/OFFSET where appropriate. Do not use PostgreSQL-only functions.',
      sqlite: 'Use SQLite syntax and LIMIT/OFFSET where appropriate. Use SQLite-compatible date and string functions.',
      sqlserver: 'Use SQL Server syntax. Use TOP for simple limits, or OFFSET/FETCH only with a deterministic ORDER BY.',
      oracle: 'Use Oracle syntax. Use FETCH FIRST/OFFSET or an Oracle-compatible row limiting pattern; do not use LIMIT.'
    };
    const selectedDialectRules = dialectRules[dialect.toLowerCase()] || `Use syntax supported by ${dialect}.`;

    return `
You are DataPilot AI, an expert ${dialect} Data Analyst and Database Copilot.
Convert the user's natural language question into an accurate, optimized, read-only query for the connected ${dialect} database.

${schemaText}

${historyText}${retryText}
USER QUESTION:
"${question}"

CRITICAL SYSTEM INSTRUCTIONS:
1. STRICT SCHEMA GROUNDING:
   - Use ONLY real tables and columns present in the verified schema above.
   - NEVER invent table names, column names, relationships, or metrics.
   - If the user asks for a metric or concept (e.g. "churn", "growth", "revenue", "profit") and the required columns DO NOT exist in the database, set "sql": "" and state in "warnings": ["I cannot calculate this reliably because the connected database does not contain the required fields."].

2. READ-ONLY ${dialect.toUpperCase()} SQL:
   - Generate ONLY single-statement SELECT or WITH queries.
   - DO NOT generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, CALL, DO, or multi-statement queries.
   - Always qualify column names with table name or table alias when joining multiple tables to avoid ambiguity.
  - Use only syntax and functions supported by ${dialect}. Do not use PostgreSQL-only syntax for another dialect.
  - DIALECT RULE: ${selectedDialectRules}
   - Apply reasonable LIMIT clauses (e.g., LIMIT 100) if user asks for top/bottom or large queries, unless aggregating.

3. AMBIGUITY HANDLING:
   - If the user's question is fundamentally ambiguous (e.g. "Show me sales" when there are multiple metrics like order_amount, quantity, or profit), set:
     "clarificationNeeded": true,
     "clarificationQuestion": "What would you like to analyze: revenue, quantity, or number of orders?",
     "clarificationOptions": ["Revenue", "Order Count", "Units Sold"]
   - If the intent is sufficiently clear, generate the SQL directly without asking.

Return a JSON object conforming to this exact structure:
{
  "understanding": "Short description of what the user requested",
  "sql": "SELECT ...",
  "tablesUsed": ["schema.table1", "schema.table2"],
  "explanation": "Short, clear explanation of how the query computes the result",
  "assumptions": ["Any reasonable assumption made"],
  "warnings": ["Any warnings or caveats"],
  "clarificationNeeded": false,
  "clarificationQuestion": "",
  "clarificationOptions": []
}
`;
  }

  /**
   * Generates a complete, multi-widget Dashboard proposal grounded strictly in verified database schema
   */
  public static async generateDashboardPlan(
    prompt: string,
    sessionId: string
  ): Promise<{
    dashboardTitle: string;
    dashboardDescription: string;
    widgets: {
      title: string;
      description: string;
      chartType: 'kpi' | 'bar' | 'horizontal_bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'histogram' | 'table';
      colSpan: 3 | 4 | 6 | 8 | 12;
      height: number;
      sql: string;
      sourceTable?: string;
      explanation: string;
    }[];
    warnings: string[];
  }> {
    const adapter = ConnectionManager.getInstance().getAdapter(sessionId);
    if (!adapter || !adapter.isConnected()) {
      throw new Error('Database is not connected. Please connect to a database first to generate dashboards.');
    }
    const schemaContext = await SchemaContextService.buildContext(adapter, prompt);
    const schemaText = schemaContext.formattedPromptContext;

    // If Gemini is not configured, generate a deterministic dashboard using the actual discovered schema
    if (!isGeminiConfigured() || schemaContext.tables.length === 0) {
      return this.generateDeterministicDashboardPlan(prompt, schemaContext);
    }

    const systemPrompt = `
You are DataPilot AI, an elite Data Architect and Executive Dashboard Designer.
The user wants to generate a complete analytics dashboard in DataPilot based on their natural language request:
"${prompt}"

${schemaText}

CRITICAL RULES:
1. STRICT SCHEMA GROUNDING:
   - Use ONLY actual tables and columns present in the schema above.
   - Do NOT invent any tables, columns, or metrics.
   - Generate between 3 and 6 cohesive widgets that together answer the user's dashboard objective.
2. READ-ONLY SQL:
   - Every single widget SQL statement must be a safe, read-only SELECT query.
   - Limit raw row queries to 50 rows, aggregations/group by to 10-20 rows.
3. APPROPRIATE CHART TYPES:
   - KPI for single metrics/totals (colSpan: 3 or 4, height: 180)
   - Line / Area for temporal trends over dates (colSpan: 6 or 8, height: 320)
   - Bar / Horizontal Bar for categorical breakdowns (colSpan: 6, height: 320)
   - Pie / Donut for status or category shares with <= 8 categories (colSpan: 4 or 6, height: 320)
   - Table for multi-column record lists (colSpan: 12, height: 360)

Return JSON adhering to this exact format:
{
  "dashboardTitle": "Clear, Professional Dashboard Title",
  "dashboardDescription": "Executive description of metrics and insights tracked",
  "widgets": [
    {
      "title": "Widget Title",
      "description": "Short explanation",
      "chartType": "kpi",
      "colSpan": 3,
      "height": 180,
      "sql": "SELECT ...",
      "sourceTable": "table_name",
      "explanation": "Why this query was chosen"
    }
  ],
  "warnings": []
}
`;

    try {
      const response = await generateContentWithFallback({
        contents: systemPrompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });
      const responseText = response.text || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.generateDeterministicDashboardPlan(prompt, schemaContext);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validWidgets = [];

      for (const w of parsed.widgets || []) {
        if (!w.sql || typeof w.sql !== 'string') continue;
        const safety = QuerySafetyValidator.validate(w.sql);
        if (!safety.isValid) continue;

        const schemaVal = SchemaValidator.validate(w.sql, schemaContext.tables);
        if (!schemaVal.isValid) continue;

        validWidgets.push({
          title: w.title || 'Untitled Widget',
          description: w.description || '',
          chartType: w.chartType || 'bar',
          colSpan: ([3, 4, 6, 8, 12].includes(w.colSpan) ? w.colSpan : 6) as 3 | 4 | 6 | 8 | 12,
          height: typeof w.height === 'number' ? w.height : 300,
          sql: w.sql.trim(),
          sourceTable: w.sourceTable || (schemaContext.tables[0]?.tableName ?? undefined),
          explanation: w.explanation || ''
        });
      }

      if (validWidgets.length === 0) {
        return this.generateDeterministicDashboardPlan(prompt, schemaContext);
      }

      return {
        dashboardTitle: parsed.dashboardTitle || 'Custom Analytics Dashboard',
        dashboardDescription: parsed.dashboardDescription || `Dashboard generated for: ${prompt}`,
        widgets: validWidgets,
        warnings: parsed.warnings || []
      };
    } catch {
      return this.generateDeterministicDashboardPlan(prompt, schemaContext);
    }
  }

  /**
   * Deterministic schema-grounded fallback for dashboard creation
   */
  private static generateDeterministicDashboardPlan(
    prompt: string,
    schemaContext: any
  ): {
    dashboardTitle: string;
    dashboardDescription: string;
    widgets: any[];
    warnings: string[];
  } {
    const tables = schemaContext.tables || [];
    if (tables.length === 0) {
      return {
        dashboardTitle: 'Analytics Dashboard',
        dashboardDescription: 'Please connect a database to discover available tables and metrics.',
        widgets: [],
        warnings: ['No database tables available in the current connection.']
      };
    }

    const widgets = [];
    const mainTable = tables[0];
    const tableName = mainTable.name;
    const safeTable = `"${mainTable.schema}"."${tableName}"`;

    // 1. KPI: Total row count
    widgets.push({
      title: `Total ${tableName} Records`,
      description: `Overall count of entries in ${tableName}`,
      chartType: 'kpi',
      colSpan: 4,
      height: 180,
      sql: `SELECT COUNT(*) AS total_count FROM ${safeTable};`,
      sourceTable: tableName,
      explanation: 'Provides immediate benchmark metric for the dataset size.'
    });

    // 2. Categorical breakdown if a text column exists
    const textCols = mainTable.columns.filter((c: any) =>
      ['varchar', 'text', 'character varying', 'char'].includes(c.dataType.toLowerCase())
    );
    if (textCols.length > 0) {
      const col = textCols[0].name;
      widgets.push({
        title: `Distribution by ${col}`,
        description: `Breakdown of records grouped by ${col}`,
        chartType: 'bar',
        colSpan: 8,
        height: 320,
        sql: `SELECT "${col}", COUNT(*) AS count FROM ${safeTable} GROUP BY "${col}" ORDER BY count DESC LIMIT 10;`,
        sourceTable: tableName,
        explanation: 'Shows concentration of top categories.'
      });
    }

    // 3. Numeric measure if numeric column exists
    const numCols = mainTable.columns.filter((c: any) =>
      ['int', 'integer', 'numeric', 'decimal', 'double precision', 'real', 'bigint'].includes(c.dataType.toLowerCase())
    );
    if (numCols.length > 0) {
      const numCol = numCols[0].name;
      widgets.push({
        title: `Total & Average ${numCol}`,
        description: `Key aggregate statistics for ${numCol}`,
        chartType: 'kpi',
        colSpan: 4,
        height: 180,
        sql: `SELECT SUM("${numCol}") AS total, AVG("${numCol}") AS average FROM ${safeTable};`,
        sourceTable: tableName,
        explanation: 'Monitors total volume and central tendency.'
      });
    }

    // 4. Sample Record List
    widgets.push({
      title: `Recent ${tableName} Entries`,
      description: `Preview of raw tabular data from ${tableName}`,
      chartType: 'table',
      colSpan: numCols.length > 0 ? 8 : 12,
      height: 320,
      sql: `SELECT * FROM ${safeTable} LIMIT 25;`,
      sourceTable: tableName,
      explanation: 'Inspect individual records directly on the dashboard canvas.'
    });

    return {
      dashboardTitle: `${tableName.charAt(0).toUpperCase() + tableName.slice(1)} Dashboard`,
      dashboardDescription: `Automated schema-grounded dashboard generated for ${prompt || tableName}`,
      widgets,
      warnings: []
    };
  }

  /**
   * Generates cross-widget factual insights derived strictly from displayed results
   */
  public static async generateDashboardInsights(
    dashboardName: string,
    widgetSummaries: {
      title: string;
      chartType: string;
      rowCount: number;
      columns: string[];
      sampleMetrics: Record<string, any>;
    }[]
  ): Promise<{
    insights: {
      id: string;
      title: string;
      text: string;
      type: 'trend' | 'outlier' | 'benchmark' | 'metric';
      widgetSourceTitle?: string;
      evidence?: string;
    }[];
  }> {
    if (!isGeminiConfigured()) {
      return {
        insights: widgetSummaries.map((w, i) => ({
          id: `ins-${i}`,
          title: `${w.title} Summary`,
          text: `Visualizing ${w.rowCount.toLocaleString()} records across ${w.columns.join(', ')}.`,
          type: 'metric',
          widgetSourceTitle: w.title,
          evidence: `Dataset contains ${w.rowCount} observations.`
        }))
      };
    }

    const prompt = `
You are DataPilot AI, providing executive-level factual insights for the dashboard: "${dashboardName}".

WIDGET DATA SUMMARIES:
${JSON.stringify(widgetSummaries, null, 2)}

STRICT RULES:
1. ONLY state facts directly proven by the numbers provided in the summaries.
2. NEVER invent numbers, never hallucinate percentages, never assume causal explanations.
3. Identify top/bottom values, volumes, concentrations, and key comparisons.

Return JSON:
{
  "insights": [
    {
      "id": "ins-1",
      "title": "Short punchy insight title",
      "text": "Factual description grounded strictly in the data",
      "type": "metric",
      "widgetSourceTitle": "Widget Title",
      "evidence": "Exact metric value from data"
    }
  ]
}
`;

    try {
      const resp = await generateContentWithFallback({
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });
      const respText = resp.text || '';
      const match = respText.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
      // Fallback
    }

    return {
      insights: widgetSummaries.map((w, i) => ({
        id: `ins-${i}`,
        title: `${w.title} Overview`,
        text: `Active widget with ${w.rowCount} records returned across ${w.columns.length} columns.`,
        type: 'benchmark',
        widgetSourceTitle: w.title,
        evidence: `Sample metrics: ${JSON.stringify(w.sampleMetrics)}`
      }))
    };
  }
}

