import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  Clock,
  CheckCircle2,
  Activity,
  AlertCircle,
  FileCode2,
  ShieldCheck,
  Code,
  XCircle,
  History,
  Trash2,
  ChevronDown,
  Bot,
  Save,
  Copy,
  BookTemplate,
  Loader2
} from 'lucide-react';
import { QueryExecutionResult, QueryHistoryItem, DiscoveredTable, TableDetailsResult } from '../../types/database';
import { getSuggestions, Suggestion } from '../../utils/sqlAutocomplete';
import { getCaretCoordinates } from '../../utils/caretCoordinates';
import { SqlAutocomplete } from './SqlAutocomplete';
import { SnippetLibraryModal } from './SnippetLibraryModal';
import { SqlSyntaxHighlighter } from './SqlSyntaxHighlighter';
import { formatSql } from '../../utils/sqlFormatter';

interface SqlEditorProps {
  query: string;
  onChangeQuery: (query: string) => void;
  onRunQuery: () => void;
  onCancelQuery?: () => void;
  onClearQuery: () => void;
  onExplainSql?: (sql: string) => void;
  onAnalyzePerformance?: (sql: string) => void;
  isRunning: boolean;
  lastResult: QueryExecutionResult | null;
  history?: QueryHistoryItem[];
  onSelectHistoryItem?: (item: QueryHistoryItem) => void;
  onClearHistory?: () => void;
  tables?: DiscoveredTable[];
  tableDetailsCache?: Record<string, TableDetailsResult>;
  onSaveQuery?: () => void;
  onSaveAsQuery?: () => void;
  onOpenLibrary?: () => void;
  isSaved?: boolean;
  isModified?: boolean;
  onRevertQuery?: () => void;
  dialect?: string;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  query,
  onChangeQuery,
  onRunQuery,
  onCancelQuery,
  onClearQuery,
  onExplainSql,
  onAnalyzePerformance,
  isRunning,
  lastResult,
  history = [],
  onSelectHistoryItem,
  onClearHistory,
  tables = [],
  tableDetailsCache = {},
  onSaveQuery,
  onSaveAsQuery,
  onOpenLibrary,
  isSaved,
  isModified,
  onRevertQuery,
  dialect = 'postgresql'
}) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSnippetsOpen, setIsSnippetsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caretPos, setCaretPos] = useState({ top: 0, left: 0 });
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [currentFilter, setCurrentFilter] = useState('');

  const updateSuggestions = (val: string, cursor: number, forceOpen = false) => {
    const { suggestions: newSugs, prefix, filterText } = getSuggestions(val, cursor, tables, tableDetailsCache);
    if (newSugs.length > 0 && (filterText.length > 0 || forceOpen || prefix.length > 0)) {
      setSuggestions(newSugs);
      setSelectedIndex(0);
      setCurrentPrefix(prefix);
      setCurrentFilter(filterText);
      setIsAutocompleteOpen(true);

      if (textareaRef.current) {
        const coords = getCaretCoordinates(textareaRef.current, cursor);
        coords.top -= textareaRef.current.scrollTop;
        coords.left -= textareaRef.current.scrollLeft;
        setCaretPos(coords);
      }
    } else {
      setIsAutocompleteOpen(false);
    }
  };

  const insertSnippet = (snippetSql: string) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const textBefore = query.substring(0, cursor);
    const textAfter = query.substring(cursor);

    const needsNewlineBefore = textBefore.length > 0 && !textBefore.endsWith('\n');
    const prefix = needsNewlineBefore ? '\n' : '';

    const newQuery = textBefore + prefix + snippetSql + textAfter;
    onChangeQuery(newQuery);

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursor = textBefore.length + prefix.length + snippetSql.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  const insertSuggestion = (suggestion: Suggestion) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const textBefore = query.substring(0, cursor);
    const textAfter = query.substring(cursor);

    let replacement = suggestion.name;
    if (suggestion.name.includes(' ') && suggestion.type !== 'keyword') {
      replacement = `"${suggestion.name}"`;
    }

    let newBefore = textBefore;
    if (currentFilter.length > 0) {
      newBefore = newBefore.slice(0, -currentFilter.length);
    }

    const newQuery = newBefore + replacement + textAfter;
    onChangeQuery(newQuery);
    setIsAutocompleteOpen(false);

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursor = newBefore.length + replacement.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  // Close history dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyMenuRef.current && !historyMenuRef.current.contains(e.target as Node)) {
        setIsHistoryOpen(false);
      }
    };
    if (isHistoryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isHistoryOpen]);

  const handleFormat = () => {
    const formatted = formatSql(query);
    onChangeQuery(formatted);
  };

  const handleScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (gutterRef.current) {
        gutterRef.current.scrollTop = scrollTop;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = scrollTop;
        highlightRef.current.scrollLeft = scrollLeft;
      }
    }
  };

  // Synchronize highlight overlay and line number gutter when query changes
  useEffect(() => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (highlightRef.current) {
        highlightRef.current.scrollTop = scrollTop;
        highlightRef.current.scrollLeft = scrollLeft;
      }
      if (gutterRef.current) {
        gutterRef.current.scrollTop = scrollTop;
      }
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl + Shift + Space for Snippets
    if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
      e.preventDefault();
      setIsSnippetsOpen(true);
      return;
    }
    if (isAutocompleteOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAutocompleteOpen(false);
        return;
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isRunning && query.trim()) {
        onRunQuery();
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === ' ') {
      e.preventDefault();
      updateSuggestions(query, e.currentTarget.selectionStart, true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChangeQuery(e.target.value);
    updateSuggestions(e.target.value, e.target.selectionStart);
  };

  const handleClick = () => {
    setIsAutocompleteOpen(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsAutocompleteOpen(false);
    }, 150);
  };

  // Calculate line numbers
  const lines = query.split('\n');
  const lineCount = Math.max(lines.length, 8);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div
      id="sql-editor-panel"
      className="flex flex-col h-full bg-slate-950 text-slate-200 min-h-0 overflow-hidden"
    >
      {/* Query Toolbar: Organized into Logical Groups */}
      <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-3 py-1.5 select-none flex-wrap gap-1.5 flex-shrink-0">
        {/* Left: Library & Save Utilities */}
        <div className="flex items-center space-x-1.5">
          {onOpenLibrary && (
            <button
              id="btn-query-library"
              type="button"
              onClick={onOpenLibrary}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 rounded transition-colors"
              title="Open Query Library"
              aria-label="Open Query Library"
            >
              <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Library</span>
            </button>
          )}

          {(onSaveQuery || onSaveAsQuery) && (
            <div className="flex items-center space-x-1 border-l border-slate-800 pl-1.5">
              {onSaveQuery && (
                <button
                  id="btn-save-query"
                  type="button"
                  onClick={onSaveQuery}
                  className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                    isSaved && !isModified
                      ? 'text-slate-500 bg-slate-900 border-slate-800 cursor-default'
                      : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border-slate-700/60'
                  }`}
                  disabled={isSaved && !isModified}
                  title={isSaved && !isModified ? 'Query Saved' : 'Save Query (Ctrl+S)'}
                  aria-label="Save Query"
                >
                  <Save className="w-3.5 h-3.5 text-sky-400" />
                  <span>{isSaved && !isModified ? 'Saved' : 'Save'}</span>
                </button>
              )}

              {isSaved && onSaveAsQuery && (
                <button
                  id="btn-save-as-query"
                  type="button"
                  onClick={onSaveAsQuery}
                  className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 rounded transition-colors"
                  title="Save As New Query"
                  aria-label="Save As New Query"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Save As</span>
                </button>
              )}

              {isSaved && isModified && onRevertQuery && (
                <button
                  id="btn-revert-query"
                  type="button"
                  onClick={onRevertQuery}
                  className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-950/60 border border-amber-800/60 rounded transition-colors"
                  title="Revert to saved query"
                  aria-label="Revert to saved query"
                >
                  <span>Revert</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Secondary Actions, Utilities & Primary Run Query Action */}
        <div className="flex items-center space-x-1.5 relative">
          {/* Secondary Actions: Format, Performance, Explain */}
          <button
            id="btn-format-sql"
            onClick={handleFormat}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 rounded transition-colors"
            title="Format and standardize SQL indentation"
            aria-label="Format SQL"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Format</span>
          </button>

          {onAnalyzePerformance && (
            <button
              id="btn-performance-sql"
              onClick={() => onAnalyzePerformance(query)}
              disabled={!query.trim() || isRunning}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-amber-300 hover:text-white bg-amber-950/50 hover:bg-amber-900/70 border border-amber-700/50 rounded transition-colors disabled:opacity-40"
              title="Analyze Query Performance & Indexes"
              aria-label="Performance Analysis"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Performance</span>
            </button>
          )}

          {onExplainSql && (
            <button
              id="btn-explain-sql"
              onClick={() => onExplainSql(query)}
              disabled={!query.trim() || isRunning}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-950/50 hover:bg-indigo-900/70 border border-indigo-700/50 rounded transition-colors disabled:opacity-40"
              title="Explain this SQL query with AI"
              aria-label="Explain SQL with AI"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Explain</span>
            </button>
          )}

          {/* Divider */}
          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Utility: Snippets */}
          <button
            id="btn-snippets-modal"
            type="button"
            onClick={() => setIsSnippetsOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 rounded transition-colors"
            title="SQL Snippets (Ctrl+Shift+Space)"
            aria-label="SQL Snippets"
          >
            <BookTemplate className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Snippets</span>
          </button>

          {/* Utility: Query History Dropdown */}
          <div ref={historyMenuRef} className="relative">
            <button
              id="btn-query-history"
              type="button"
              onClick={() => setIsHistoryOpen(prev => !prev)}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 rounded transition-colors"
              title="View recent query history"
              aria-label="Recent Query History"
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">History</span>
              {history.length > 0 && (
                <span className="px-1.5 py-0.2 bg-slate-950 text-slate-400 rounded-full text-[10px] font-mono">
                  {history.length}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isHistoryOpen && (
              <div
                id="query-history-dropdown"
                className="absolute right-0 mt-1.5 w-80 max-h-80 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden text-xs"
              >
                <div className="p-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
                  <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                    <History className="w-3.5 h-3.5 text-sky-400" />
                    <span>Recent Query History</span>
                  </div>
                  {history.length > 0 && onClearHistory && (
                    <button
                      onClick={() => {
                        onClearHistory();
                        setIsHistoryOpen(false);
                      }}
                      className="text-slate-500 hover:text-rose-400 flex items-center space-x-1 text-[11px] transition-colors"
                      title="Clear history"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-800/40">
                  {history.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">
                      <p>No queries executed yet.</p>
                      <p className="text-[11px] text-slate-600 mt-1">Queries you run will appear here.</p>
                    </div>
                  ) : (
                    history.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectHistoryItem?.(item);
                          setIsHistoryOpen(false);
                        }}
                        className="w-full text-left p-2 rounded hover:bg-slate-800/80 transition-colors group flex flex-col space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase font-mono ${
                              item.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : item.status === 'cancelled'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="font-mono text-slate-300 text-[11px] truncate group-hover:text-emerald-300">
                          {item.query.replace(/\n/g, ' ')}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                          <span>{item.executionTimeMs} ms</span>
                          {item.status === 'success' && (
                            <>
                              <span>•</span>
                              <span>{item.rowCount} rows</span>
                            </>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Utility: Clear */}
          <button
            id="btn-clear-sql"
            onClick={onClearQuery}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-750 border border-slate-700/50 rounded transition-colors"
            title="Clear editor contents"
            aria-label="Clear SQL"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          {/* Primary Action: RUN QUERY / CANCEL */}
          {isRunning ? (
            <button
              id="btn-cancel-query"
              onClick={onCancelQuery}
              className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-rose-400"
              title="Cancel running query"
              aria-label="Cancel Running Query"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              id="btn-run-query"
              onClick={onRunQuery}
              disabled={!query.trim() || isRunning}
              className="flex items-center space-x-1.5 px-3.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none rounded shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-emerald-400"
              title="Execute SQL query (Ctrl+Enter / ⌘+Enter)"
              aria-label="Run Query"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Query</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Main Surface: Line Numbers + Textarea with Synchronized Scrolling */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden font-mono text-xs">
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="w-11 py-3 bg-slate-950/90 select-none text-slate-600 text-right pr-2.5 border-r border-slate-900 leading-5 font-mono text-[11px] overflow-hidden flex-shrink-0"
        >
          {lineNumbers.map(n => (
            <div key={n} className="h-5">{n}</div>
          ))}
        </div>

        {/* SQL Input Area: Constrained to Parent, Horizontal Scroll Only for Long Lines */}
        <div className="relative flex-1 h-full min-w-0 overflow-hidden bg-slate-950">
          {/* Syntax Highlighting Render Layer (Synchronized scrolling with textarea) */}
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
          >
            <SqlSyntaxHighlighter
              sql={query}
              tables={tables}
              tableDetailsCache={tableDetailsCache}
              dialect={dialect}
            />
          </div>

          {/* Autocomplete Popup Layer */}
          {isAutocompleteOpen && (
            <div className="relative z-20 pointer-events-auto">
              <SqlAutocomplete
                suggestions={suggestions}
                selectedIndex={selectedIndex}
                onSelect={insertSuggestion}
                position={caretPos}
              />
            </div>
          )}

          {/* Editable Transparent Textarea with Visible Caret & Selection */}
          <textarea
            ref={textareaRef}
            id="sql-query-input"
            value={query}
            onChange={handleChange}
            onClick={handleClick}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            placeholder="-- Write your read-only SQL query here (e.g. SELECT * FROM customers LIMIT 50;)"
            spellCheck={false}
            style={{ tabSize: 2 }}
            className="relative z-10 w-full h-full p-3 bg-transparent text-transparent caret-sky-400 placeholder-slate-600 resize-none focus:outline-hidden leading-5 font-mono text-xs selection:bg-sky-500/30 overflow-auto whitespace-pre border-0"
          />
        </div>
      </div>

      {/* Query Status Bar */}
      <div
        id="query-status-bar"
        className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 select-none flex-shrink-0"
      >
        <div className="flex items-center space-x-3 overflow-hidden truncate">
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <span className="text-slate-500 font-medium text-[11px]">Status:</span>
            {isRunning ? (
              <span className="flex items-center space-x-1 text-amber-400 font-medium text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>Executing query...</span>
              </span>
            ) : lastResult?.status === 'success' ? (
              <span className="flex items-center space-x-1 text-emerald-400 font-medium text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Success</span>
              </span>
            ) : lastResult?.status === 'cancelled' ? (
              <span className="flex items-center space-x-1 text-amber-400 font-medium text-[11px]">
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancelled</span>
              </span>
            ) : lastResult?.status === 'error' ? (
              <span className="flex items-center space-x-1 text-rose-400 font-medium text-[11px]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Error</span>
              </span>
            ) : (
              <span className="text-slate-400 text-[11px]">Ready</span>
            )}
          </div>

          {lastResult && lastResult.status !== 'idle' && (
            <>
              <div className="h-3 w-px bg-slate-800 flex-shrink-0" />
              <div className="flex items-center space-x-1 flex-shrink-0 text-[11px]">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{lastResult.executionTimeMs} ms</span>
              </div>

              {lastResult.status === 'success' && (
                <>
                  <div className="h-3 w-px bg-slate-800 flex-shrink-0" />
                  <div className="flex items-center space-x-1 flex-shrink-0 text-[11px]">
                    <Code className="w-3 h-3 text-slate-500" />
                    <span className="font-mono text-slate-300">
                      {lastResult.rowCount.toLocaleString()} {lastResult.rowCount === 1 ? 'row' : 'rows'}
                    </span>
                    {lastResult.isTruncated && (
                      <span className="text-amber-400 text-[10px] ml-0.5 font-semibold">
                        (Limited)
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Security & shortcut hint */}
        <div className="flex items-center space-x-2.5 text-[11px] text-slate-500 flex-shrink-0">
          <span className="hidden sm:flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
            <span>Read-Only Mode</span>
          </span>
          <span className="hidden md:inline-block px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700/80 font-mono text-[10px] text-slate-400">
            Ctrl + Enter to run
          </span>
        </div>
      </div>

      <SnippetLibraryModal
        isOpen={isSnippetsOpen}
        onClose={() => setIsSnippetsOpen(false)}
        onInsert={insertSnippet}
        tables={tables}
        tableDetailsCache={tableDetailsCache}
      />
    </div>
  );
};
