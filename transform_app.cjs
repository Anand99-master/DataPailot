const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add SqlEditorTab to imports
content = content.replace(
  "QueryHistoryItem,\n  QueryResult",
  "QueryHistoryItem,\n  QueryResult,\n  SqlEditorTab"
);

// Add SqlEditorTabs import
content = content.replace(
  "import { SqlEditor } from './components/Editor/SqlEditor';",
  "import { SqlEditor } from './components/Editor/SqlEditor';\nimport { SqlEditorTabs } from './components/Editor/SqlEditorTabs';"
);

const defaultQuery = `-- Write your read-only SQL query here\nSELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public';\n`;

// Replace the SQL Editor state
const stateReplacement = `
  // SQL Editor Tabs state
  const [tabs, setTabs] = useState<SqlEditorTab[]>(() => {
    try {
      const saved = localStorage.getItem('datapilot_sql_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed.map((t: any) => ({ ...t, isRunning: false, result: null }));
      }
    } catch {}
    return [{
      id: 'tab-1',
      name: 'Query 1.sql',
      query: \`${defaultQuery}\`,
      result: null,
      isRunning: false
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem('datapilot_active_tab_id') || 'tab-1';
  });

  const [tabCounter, setTabCounter] = useState<number>(() => {
    const saved = localStorage.getItem('datapilot_tab_counter');
    return saved ? parseInt(saved, 10) : 2;
  });

  useEffect(() => {
    const tabsToSave = tabs.map(t => ({ id: t.id, name: t.name, query: t.query }));
    localStorage.setItem('datapilot_sql_tabs', JSON.stringify(tabsToSave));
    localStorage.setItem('datapilot_active_tab_id', activeTabId);
    localStorage.setItem('datapilot_tab_counter', tabCounter.toString());
  }, [tabs, activeTabId, tabCounter]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const sqlQuery = activeTab.query;
  const isRunningQuery = activeTab.isRunning;
  const queryResult = activeTab.result;
  const queryAbortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const setSqlQuery = (val: string | ((prev: string) => string)) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, query: typeof val === 'function' ? val(t.query) : val } : t));
  };
  const setIsRunningQuery = (val: boolean | ((prev: boolean) => boolean), targetId = activeTabId) => {
    setTabs(prev => prev.map(t => t.id === targetId ? { ...t, isRunning: typeof val === 'function' ? val(t.isRunning) : val } : t));
  };
  const setQueryResult = (val: QueryExecutionResult | null | ((prev: QueryExecutionResult | null) => QueryExecutionResult | null), targetId = activeTabId) => {
    setTabs(prev => prev.map(t => t.id === targetId ? { ...t, result: typeof val === 'function' ? val(t.result) : val } : t));
  };

  const handleAddTab = () => {
    const newId = \`tab-\${Date.now()}\`;
    const newTab: SqlEditorTab = {
      id: newId,
      name: \`Query \${tabCounter}.sql\`,
      query: '',
      result: null,
      isRunning: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setTabCounter(prev => prev + 1);
  };

  const handleCloseTab = (id: string) => {
    const tabToClose = tabs.find(t => t.id === id);
    if (!tabToClose) return;
    
    // Prevent accidental loss
    const isUnsaved = tabToClose.query.trim().length > 0 && tabToClose.query !== \`${defaultQuery}\`;
    if (isUnsaved) {
      if (!window.confirm(\`Close \${tabToClose.name}? Unsaved SQL will be lost.\`)) {
        return;
      }
    }
    
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (filtered.length === 0) {
        // Always keep at least one tab
        const newId = \`tab-\${Date.now()}\`;
        setActiveTabId(newId);
        setTabCounter(prevC => prevC + 1);
        return [{ id: newId, name: \`Query \${tabCounter}.sql\`, query: '', result: null, isRunning: false }];
      }
      if (activeTabId === id) {
        const idx = prev.findIndex(t => t.id === id);
        const nextTab = prev[idx - 1] || prev[idx + 1] || filtered[0];
        setActiveTabId(nextTab.id);
      }
      return filtered;
    });
    
    // Cancel query if running
    const controller = queryAbortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      queryAbortControllersRef.current.delete(id);
    }
  };

  const handleRenameTab = (id: string, newName: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  const handleDuplicateTab = (id: string) => {
    const tabToDup = tabs.find(t => t.id === id);
    if (!tabToDup) return;
    const newId = \`tab-\${Date.now()}\`;
    const newTab: SqlEditorTab = {
      id: newId,
      name: \`\${tabToDup.name} (copy)\`,
      query: tabToDup.query,
      result: null,
      isRunning: false
    };
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      const newTabs = [...prev];
      newTabs.splice(idx + 1, 0, newTab);
      return newTabs;
    });
    setActiveTabId(newId);
  };

  // Query History state (persisted locally)
`;

content = content.replace(
  /\/\/ SQL Editor state[\s\S]*?\/\/ Query History state \(persisted locally\)/,
  stateReplacement
);

// Update handleCancelQuery
const cancelReplacement = `
  const handleCancelQuery = () => {
    const controller = queryAbortControllersRef.current.get(activeTabId);
    if (controller) {
      controller.abort();
      queryAbortControllersRef.current.delete(activeTabId);
    }
    setIsRunningQuery(false, activeTabId);
  };
`;
content = content.replace(
  /const handleCancelQuery = \(\) => \{[\s\S]*?setIsRunningQuery\(false\);\s*\};/,
  cancelReplacement.trim()
);

// Update executeSql to use activeTabId
const executeReplacement = `
  const executeSql = async (sqlToRun: string) => {
    const queryStr = sqlToRun.trim();
    const targetTabId = activeTabId;
    const targetTab = tabs.find(t => t.id === targetTabId) || tabs[0];
    
    if (!queryStr || targetTab.isRunning) return;

    const controller = new AbortController();
    queryAbortControllersRef.current.set(targetTabId, controller);
    setIsRunningQuery(true, targetTabId);

    try {
      const result = await DatabaseApiClient.executeQuery(queryStr, 1000, controller.signal);
      setQueryResult(result, targetTabId);

      if (result.status === 'success' || result.status === 'error' || result.status === 'cancelled') {
        const historyItem: QueryHistoryItem = {
          id: String(Date.now()),
          query: queryStr,
          timestamp: new Date().toISOString(),
          status: result.status,
          executionTimeMs: result.executionTimeMs,
          rowCount: result.rowCount,
          errorMessage: result.errorMessage
        };
        setQueryHistory(prev => [historyItem, ...prev.filter(h => h.query !== queryStr).slice(0, 49)]);
      }
    } catch (err: any) {
      const errResult: QueryExecutionResult = {
        query: queryStr,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        status: 'error',
        errorMessage: err.message || 'Failed to execute query',
        timestamp: new Date()
      };
      setQueryResult(errResult, targetTabId);
      
      const historyItem: QueryHistoryItem = {
        id: String(Date.now()),
        query: queryStr,
        timestamp: new Date().toISOString(),
        status: 'error',
        executionTimeMs: 0,
        rowCount: 0,
        errorMessage: err.message || 'Failed to execute query'
      };
      setQueryHistory(prev => [historyItem, ...prev.filter(h => h.query !== queryStr).slice(0, 49)]);
    } finally {
      setIsRunningQuery(false, targetTabId);
      queryAbortControllersRef.current.delete(targetTabId);
    }
  };
`;
content = content.replace(
  /const executeSql = async \(sqlToRun: string\) => \{[\s\S]*?\}\s*\} catch \(err: any\) \{[\s\S]*?\}\s*\};/,
  executeReplacement.trim()
);

// Inject SqlEditorTabs
const tabHtml = `
                {/* Top Half: SQL Editor */}
                <div className="h-1/2 min-h-[220px] flex flex-col">
                  <SqlEditorTabs
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onTabSelect={setActiveTabId}
                    onTabClose={handleCloseTab}
                    onTabAdd={handleAddTab}
                    onTabRename={handleRenameTab}
                    onTabDuplicate={handleDuplicateTab}
                  />
                  <SqlEditor
`;
content = content.replace(
  /\{\/\* Top Half: SQL Editor \*\/\}\s*<div className="h-1\/2 min-h-\[220px\] flex flex-col">\s*<SqlEditor/,
  tabHtml.trim()
);

fs.writeFileSync('src/App.tsx', content);
