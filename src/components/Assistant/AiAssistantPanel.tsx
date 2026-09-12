import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  HelpCircle,
  Clock,
  ChevronRight,
  Bot,
  Play,
  FileEdit,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  Database,
  Table as TableIcon,
  Layers,
  ArrowRight,
  CheckCircle2,
  Sliders,
  X,
  Code
} from 'lucide-react';
import {
  DiscoveredTable,
  AiSqlGenerationResult,
  AiExplainSqlResult,
  AiExplainResultsResult,
  AiFixSqlResult,
  AiMessage,
  AiStatus
} from '../../types/database';
import { DatabaseApiClient } from '../../services/databaseApi';

interface AiAssistantPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedTable: DiscoveredTable | null;
  onRunGeneratedQuery: (sql: string) => void;
  onEditGeneratedQuery: (sql: string) => void;
  // External trigger requests
  pendingExplainSql?: string | null;
  onClearPendingExplainSql?: () => void;
  pendingExplainResults?: {
    query: string;
    columns: { name: string; type?: string }[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
  } | null;
  onClearPendingExplainResults?: () => void;
  pendingFixSql?: { failedSql: string; errorMessage: string } | null;
  onClearPendingFixSql?: () => void;
}

type PanelState =
  | 'idle'
  | 'thinking'
  | 'generating'
  | 'validating'
  | 'needs_clarification'
  | 'ready_for_review'
  | 'executing'
  | 'success'
  | 'error';

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  isOpen,
  onToggle,
  selectedTable,
  onRunGeneratedQuery,
  onEditGeneratedQuery,
  pendingExplainSql,
  onClearPendingExplainSql,
  pendingExplainResults,
  onClearPendingExplainResults,
  pendingFixSql,
  onClearPendingFixSql
}) => {
  const [prompt, setPrompt] = useState('');
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [reviewMode, setReviewMode] = useState(true); // "Review SQL before execution" default true
  const [copiedSql, setCopiedSql] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status of Gemini AI configuration
  const [aiStatus, setAiStatus] = useState<AiStatus>({ configured: false, model: 'gemini-2.5-flash' });
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Active chat conversation
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Check AI configuration status on mount
  useEffect(() => {
    let mounted = true;
    DatabaseApiClient.getAiStatus()
      .then(st => {
        if (mounted) {
          setAiStatus(st);
          setCheckingStatus(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setAiStatus({ configured: false, model: 'gemini-2.5-flash' });
          setCheckingStatus(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, panelState]);

  // Handle external trigger: Explain SQL
  useEffect(() => {
    if (pendingExplainSql && aiStatus.configured) {
      handleExplainSql(pendingExplainSql);
      onClearPendingExplainSql?.();
    }
  }, [pendingExplainSql, aiStatus.configured]);

  // Handle external trigger: Explain Results
  useEffect(() => {
    if (pendingExplainResults && aiStatus.configured) {
      handleExplainResults(pendingExplainResults);
      onClearPendingExplainResults?.();
    }
  }, [pendingExplainResults, aiStatus.configured]);

  // Handle external trigger: Fix SQL Error
  useEffect(() => {
    if (pendingFixSql && aiStatus.configured) {
      handleFixSql(pendingFixSql.failedSql, pendingFixSql.errorMessage);
      onClearPendingFixSql?.();
    }
  }, [pendingFixSql, aiStatus.configured]);

  // Handle Copy SQL
  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSql(sql);
    setTimeout(() => setCopiedSql(null), 2000);
  };

  // 1. Submit Natural Language -> SQL
  const handleSendPrompt = async (userPromptText?: string) => {
    const textToSend = (userPromptText || prompt).trim();
    if (!textToSend) return;

    setPrompt('');
    setErrorMessage(null);

    // Append user message to conversation
    const userMsg: AiMessage = {
      id: String(Date.now()),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
      type: 'text'
    };
    setMessages(prev => [...prev, userMsg]);

    // Check if AI is configured
    if (!aiStatus.configured) {
      setPanelState('error');
      setErrorMessage('AI service is not configured. Set GEMINI_API_KEY in the server .env file and restart DataPilot.');
      return;
    }

    try {
      setPanelState('thinking');

      // Brief visual state transitions for clarity
      const timerGen = setTimeout(() => {
        setPanelState('generating');
      }, 500);

      const timerVal = setTimeout(() => {
        setPanelState('validating');
      }, 1200);

      // Build recent conversation history context
      const historyContext = messages.slice(-4).map(m => ({
        role: m.role,
        content: m.content,
        sql: m.sqlResult?.sql
      }));

      const selectedTableContext = selectedTable
        ? { schema: selectedTable.schema, name: selectedTable.name }
        : undefined;

      const result = await DatabaseApiClient.generateSqlWithAi(
        textToSend,
        selectedTableContext,
        historyContext
      );

      clearTimeout(timerGen);
      clearTimeout(timerVal);

      if (result.clarificationNeeded) {
        setPanelState('needs_clarification');
        const assistantMsg: AiMessage = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: result.clarificationQuestion || 'Could you clarify your request?',
          timestamp: new Date().toISOString(),
          type: 'clarification',
          sqlResult: result
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        setPanelState('ready_for_review');
        const assistantMsg: AiMessage = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: result.understanding,
          timestamp: new Date().toISOString(),
          type: 'sql_generation',
          sqlResult: result
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      setPanelState('error');
      setErrorMessage(err.message || 'Failed to generate query');
      const errAssistantMsg: AiMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to generate query.'}`,
        timestamp: new Date().toISOString(),
        type: 'text'
      };
      setMessages(prev => [...prev, errAssistantMsg]);
    }
  };

  // 2. Explain SQL
  const handleExplainSql = async (sql: string) => {
    setPanelState('thinking');
    setErrorMessage(null);

    const userMsg: AiMessage = {
      id: String(Date.now()),
      role: 'user',
      content: `Explain SQL: ${sql.slice(0, 80)}...`,
      timestamp: new Date().toISOString(),
      type: 'text'
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result = await DatabaseApiClient.explainSqlWithAi(sql);
      setPanelState('success');

      const assistantMsg: AiMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: result.simpleExplanation,
        timestamp: new Date().toISOString(),
        type: 'explanation',
        explainResult: result
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setPanelState('error');
      setErrorMessage(err.message || 'Failed to explain SQL');
    }
  };

  // 3. Explain Results
  const handleExplainResults = async (resultsData: {
    query: string;
    columns: { name: string; type?: string }[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
  }) => {
    setPanelState('thinking');
    setErrorMessage(null);

    const userMsg: AiMessage = {
      id: String(Date.now()),
      role: 'user',
      content: `Explain Results for: ${resultsData.query.slice(0, 80)}...`,
      timestamp: new Date().toISOString(),
      type: 'text'
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result = await DatabaseApiClient.explainResultsWithAi(
        resultsData.query,
        resultsData.columns,
        resultsData.rows,
        resultsData.rowCount,
        resultsData.executionTimeMs
      );
      setPanelState('success');

      const assistantMsg: AiMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: result.summary,
        timestamp: new Date().toISOString(),
        type: 'result_explanation',
        resultExplanation: result
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setPanelState('error');
      setErrorMessage(err.message || 'Failed to explain query results');
    }
  };

  // 4. Fix SQL Error
  const handleFixSql = async (failedSql: string, errMsg: string) => {
    setPanelState('thinking');
    setErrorMessage(null);

    const userMsg: AiMessage = {
      id: String(Date.now()),
      role: 'user',
      content: `Fix SQL Error: ${errMsg}`,
      timestamp: new Date().toISOString(),
      type: 'text'
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const result = await DatabaseApiClient.fixSqlWithAi(failedSql, errMsg);
      setPanelState('ready_for_review');

      const assistantMsg: AiMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: result.explanation,
        timestamp: new Date().toISOString(),
        type: 'error_fix',
        fixResult: result
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setPanelState('error');
      setErrorMessage(err.message || 'Failed to generate fix');
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setPanelState('idle');
    setErrorMessage(null);
  };

  if (!isOpen) {
    return (
      <button
        id="btn-open-ai-panel"
        onClick={onToggle}
        className="fixed right-3 bottom-3 z-30 flex items-center space-x-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-lg transition-all border border-indigo-400/30"
        title="Open AI Data Assistant"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>AI Data Assistant</span>
      </button>
    );
  }

  return (
    <aside
      id="ai-data-assistant-panel"
      className="w-96 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col h-full text-slate-200"
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 select-none">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h3 className="text-xs font-semibold text-white">AI Data Assistant</h3>
              {aiStatus.configured ? (
                <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-mono">
                  Active
                </span>
              ) : (
                <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-mono">
                  Unconfigured
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Schema-Aware Copilot</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-[11px] transition-colors"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Collapse panel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode & Context Banner */}
      <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
        {/* Selected table pill */}
        <div className="flex items-center space-x-1.5 truncate">
          <TableIcon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          {selectedTable ? (
            <span className="truncate text-indigo-300 font-mono text-[10px]">
              {selectedTable.schema}.{selectedTable.name}
            </span>
          ) : (
            <span className="text-slate-500 text-[10px]">All connected tables</span>
          )}
        </div>

        {/* Review Mode Toggle */}
        <label
          className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-400 hover:text-slate-300"
          title="Review generated SQL before execution"
        >
          <input
            type="checkbox"
            checked={reviewMode}
            onChange={e => setReviewMode(e.target.checked)}
            className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-3 h-3"
          />
          <span className="text-[10px]">Review SQL</span>
        </label>
      </div>

      {/* Status Alert if AI not configured */}
      {!checkingStatus && !aiStatus.configured && (
        <div className="p-3 bg-amber-950/30 border-b border-amber-900/50 text-amber-200 text-xs">
          <div className="flex items-center space-x-1.5 font-semibold text-amber-300 mb-1">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>AI Service Not Configured</span>
          </div>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            Set the server-side <code className="bg-amber-900/40 px-1 py-0.5 rounded text-amber-300 font-mono">GEMINI_API_KEY</code> in <code className="font-mono">.env</code>, then restart DataPilot.
          </p>
          <p className="text-[10px] text-amber-400/80 mt-1">
            Note: Manual SQL editing, schema inspection, and database query execution continue working normally.
          </p>
        </div>
      )}

      {/* Main Conversation / Output Area */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-xs font-sans">
        {/* Welcome / Empty State */}
        {messages.length === 0 && (
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/40 text-indigo-200">
              <div className="flex items-center space-x-2 mb-1 text-indigo-300 font-semibold text-xs">
                <Bot className="w-4 h-4 text-indigo-400" />
                <span>Ask your database in plain English</span>
              </div>
              <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                DataPilot AI inspects your live database schema, verified relationships, and table structures to generate read-only SQL for the connected database.
              </p>
            </div>

            {/* Suggested Analytical Questions */}
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Analytical Queries
              </span>
              <div className="space-y-1.5">
                {[
                  'Show total sales by month',
                  'Who are the top 10 customers by revenue?',
                  'Which products had highest growth last quarter?',
                  'Show average order value by region',
                  'How many customers made more than 3 orders?'
                ].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendPrompt(q)}
                    className="w-full text-left p-2 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-[11px] transition-all flex items-start gap-2 group"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5 group-hover:text-indigo-300" />
                    <span className="leading-snug">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Thread */}
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col space-y-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {/* User Question */}
            {msg.role === 'user' && (
              <div className="max-w-[88%] bg-indigo-600 text-white px-3 py-2 rounded-xl rounded-tr-xs text-xs shadow-sm">
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}

            {/* Assistant Reply Card */}
            {msg.role === 'assistant' && (
              <div className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-slate-200 shadow-sm space-y-2.5">
                {/* Header / Type badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-indigo-400 font-semibold text-[11px]">
                    <Bot className="w-3.5 h-3.5" />
                    <span>
                      {msg.type === 'sql_generation' && 'Generated SQL'}
                      {msg.type === 'clarification' && 'Clarification Needed'}
                      {msg.type === 'explanation' && 'SQL Explanation'}
                      {msg.type === 'result_explanation' && 'Result Summary'}
                      {msg.type === 'error_fix' && 'Suggested SQL Fix'}
                      {(!msg.type || msg.type === 'text') && 'AI Response'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Understanding description */}
                {msg.content && (
                  <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                    {msg.content}
                  </p>
                )}

                {/* Clarification Options */}
                {msg.type === 'clarification' && msg.sqlResult?.clarificationOptions && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] text-indigo-300">Choose a focus option to continue:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sqlResult.clarificationOptions.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendPrompt(opt)}
                          className="px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 text-[11px] transition-colors"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SQL Code Box (for generation or error fix) */}
                {(msg.sqlResult?.sql || msg.fixResult?.suggestedSql) && (
                  <div className="space-y-2">
                    {/* Tables Used */}
                    {((msg.sqlResult?.tablesUsed && msg.sqlResult.tablesUsed.length > 0) ||
                      (msg.fixResult?.tablesUsed && msg.fixResult.tablesUsed.length > 0)) && (
                      <div className="flex items-center flex-wrap gap-1 text-[10px]">
                        <span className="text-slate-500">Tables:</span>
                        {(msg.sqlResult?.tablesUsed || msg.fixResult?.tablesUsed || []).map((t, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-slate-800 text-indigo-300 rounded border border-slate-700 font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* SQL Syntax display */}
                    <div className="relative rounded-md bg-slate-900 border border-slate-800 overflow-hidden font-mono text-[11px]">
                      <div className="flex items-center justify-between px-2.5 py-1 bg-slate-950 border-b border-slate-800/80 text-[10px] text-slate-400">
                        <span className="flex items-center space-x-1">
                          <Code className="w-3 h-3 text-emerald-400" />
                          <span>PostgreSQL (Read-Only)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(msg.sqlResult?.sql || msg.fixResult?.suggestedSql || '')
                          }
                          className="flex items-center space-x-1 hover:text-white transition-colors"
                          title="Copy SQL"
                        >
                          {copiedSql === (msg.sqlResult?.sql || msg.fixResult?.suggestedSql) ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>
                            {copiedSql === (msg.sqlResult?.sql || msg.fixResult?.suggestedSql)
                              ? 'Copied'
                              : 'Copy'}
                          </span>
                        </button>
                      </div>

                      <pre className="p-2.5 text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
                        {msg.sqlResult?.sql || msg.fixResult?.suggestedSql}
                      </pre>
                    </div>

                    {/* Warnings / Assumptions */}
                    {msg.sqlResult?.warnings && msg.sqlResult.warnings.length > 0 && (
                      <div className="p-2 bg-amber-950/20 border border-amber-900/40 rounded text-[10px] text-amber-300/90 space-y-0.5">
                        {msg.sqlResult.warnings.map((w, i) => (
                          <p key={i}>⚠️ {w}</p>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons: [Run Query], [Edit SQL], [Regenerate] */}
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onRunGeneratedQuery(msg.sqlResult?.sql || msg.fixResult?.suggestedSql || '')
                        }
                        className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs transition-colors shadow-sm"
                        title="Execute this query in the main results grid"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Run Query</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onEditGeneratedQuery(msg.sqlResult?.sql || msg.fixResult?.suggestedSql || '')
                        }
                        className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 text-xs transition-colors"
                        title="Copy to SQL Editor"
                      >
                        <FileEdit className="w-3 h-3 text-sky-400" />
                        <span>Edit SQL</span>
                      </button>

                      {msg.sqlResult && (
                        <button
                          type="button"
                          onClick={() => handleSendPrompt(msg.sqlResult!.understanding)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 transition-colors"
                          title="Regenerate query"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Explanation Details */}
                {msg.explainResult && (
                  <div className="space-y-2 text-[11px] pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="font-semibold text-sky-400 block mb-0.5">Simple Explanation:</span>
                      <p className="text-slate-300 leading-relaxed">{msg.explainResult.simpleExplanation}</p>
                    </div>

                    <div>
                      <span className="font-semibold text-purple-400 block mb-0.5">Technical Breakdown:</span>
                      <p className="text-slate-400 leading-relaxed font-mono text-[10px]">
                        {msg.explainResult.technicalExplanation}
                      </p>
                    </div>

                    {msg.explainResult.joins.length > 0 && msg.explainResult.joins[0] !== 'None' && (
                      <div>
                        <span className="font-semibold text-slate-400 block">JOINs:</span>
                        <p className="text-slate-400">{msg.explainResult.joins.join(', ')}</p>
                      </div>
                    )}

                    {msg.explainResult.aggregations.length > 0 && msg.explainResult.aggregations[0] !== 'None' && (
                      <div>
                        <span className="font-semibold text-slate-400 block">Aggregations:</span>
                        <p className="text-slate-400">{msg.explainResult.aggregations.join(', ')}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Result Explanation Insights */}
                {msg.resultExplanation && (
                  <div className="space-y-2 text-[11px] pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="font-semibold text-emerald-400 block mb-0.5">Key Findings:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-300">
                        {msg.resultExplanation.keyInsights.map((ins, i) => (
                          <li key={i}>{ins}</li>
                        ))}
                      </ul>
                    </div>

                    {msg.resultExplanation.dataTrends.length > 0 && (
                      <div>
                        <span className="font-semibold text-indigo-400 block mb-0.5">Observed Trends:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                          {msg.resultExplanation.dataTrends.map((trend, i) => (
                            <li key={i}>{trend}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Dynamic Loading / State Indicators */}
        {(panelState === 'thinking' || panelState === 'generating' || panelState === 'validating') && (
          <div className="flex items-center space-x-2.5 p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/40 text-indigo-300 text-xs animate-pulse">
            <div className="w-4 h-4 rounded-full border-2 border-indigo-400/20 border-t-indigo-400 animate-spin flex-shrink-0" />
            <div>
              {panelState === 'thinking' && <span>Inspecting live schema &amp; relationships...</span>}
              {panelState === 'generating' && <span>Generating PostgreSQL analytical query...</span>}
              {panelState === 'validating' && <span>Validating SQL safety &amp; verified identifiers...</span>}
            </div>
          </div>
        )}

        {/* Error notification banner */}
        {panelState === 'error' && errorMessage && (
          <div className="p-3 bg-rose-950/30 border border-rose-900/60 rounded-lg text-rose-200 text-xs">
            <div className="flex items-center space-x-1.5 font-semibold text-rose-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span>Query Generation Error</span>
            </div>
            <p className="text-[11px] text-rose-300 leading-relaxed">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Input Box Area */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/95">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="relative"
        >
          <input
            type="text"
            id="ai-prompt-input"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={panelState === 'thinking' || panelState === 'generating' || panelState === 'validating'}
            placeholder={
              selectedTable
                ? `Ask about ${selectedTable.name}...`
                : 'Ask your data (e.g. sales by month)...'
            }
            className="w-full px-3 py-2 pr-10 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-sans disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || panelState === 'thinking' || panelState === 'generating' || panelState === 'validating'}
            className="absolute right-1.5 top-1.5 p-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-colors"
            title="Send query"
          >
            <Send className="w-3 h-3" />
          </button>
        </form>

        <p className="text-[10px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1">
          <HelpCircle className="w-3 h-3" />
          <span>PostgreSQL read-only analytical mode</span>
        </p>
      </div>
    </aside>
  );
};
