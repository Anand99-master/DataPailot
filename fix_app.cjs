const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Imports
content = content.replace(
  "import { SqlEditorTabs } from './components/Editor/SqlEditorTabs';",
  "import { SqlEditorTabs } from './components/Editor/SqlEditorTabs';\nimport { QueryLibraryModal } from './components/Editor/QueryLibraryModal';\nimport { SaveQueryModal } from './components/Editor/SaveQueryModal';\nimport { SavedQuery } from './types/database';"
);

// State
const stateToAdd = `
  // Query Library state
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(() => {
    try {
      const saved = localStorage.getItem('datapilot_saved_queries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('datapilot_saved_queries', JSON.stringify(savedQueries));
  }, [savedQueries]);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [saveModalState, setSaveModalState] = useState<{ isOpen: boolean; mode: 'save' | 'save_as' }>({ isOpen: false, mode: 'save' });

  const handleSaveQuerySubmit = (name: string, description: string, tags: string[]) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    
    if (saveModalState.mode === 'save' && tab.savedQueryId) {
      // Update existing
      setSavedQueries(prev => prev.map(q => q.id === tab.savedQueryId ? {
        ...q, name, description, tags, query: tab.query, updatedAt: new Date().toISOString()
      } : q));
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name, isModified: false } : t));
    } else {
      // Create new
      const newId = \`sq-\${Date.now()}\`;
      const newSavedQuery: SavedQuery = {
        id: newId,
        name,
        query: tab.query,
        description,
        tags,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setSavedQueries(prev => [...prev, newSavedQuery]);
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name, savedQueryId: newId, isModified: false } : t));
    }
    setSaveModalState({ isOpen: false, mode: 'save' });
  };

  const handleOpenLibraryQuery = (q: SavedQuery) => {
    // Open in current tab if it's empty/untouched, otherwise create new tab
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && !tab.isModified && !tab.savedQueryId && tab.query.trim() === '' || (tab && tab.query.includes('SELECT table_name, table_type'))) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name: q.name, query: q.query, savedQueryId: q.id, isModified: false } : t));
    } else {
      const newId = \`tab-\${Date.now()}\`;
      setTabs(prev => [...prev, { id: newId, name: q.name, query: q.query, result: null, isRunning: false, savedQueryId: q.id, isModified: false }]);
      setActiveTabId(newId);
      setTabCounter(prev => prev + 1);
    }
    setIsLibraryOpen(false);
  };
`;

content = content.replace(
  "  // Query History state (persisted locally)",
  stateToAdd + "\n  // Query History state (persisted locally)"
);

// setSqlQuery
const setSqlQueryReplacement = `
  const setSqlQuery = (val: string | ((prev: string) => string)) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const newQuery = typeof val === 'function' ? val(t.query) : val;
        let isModified = t.isModified;
        if (t.savedQueryId) {
          const sq = savedQueries.find(q => q.id === t.savedQueryId);
          isModified = sq ? newQuery !== sq.query : true;
        } else {
           isModified = true;
        }
        return { ...t, query: newQuery, isModified };
      }
      return t;
    }));
  };
`;
content = content.replace(
  /const setSqlQuery = \([\s\S]*?\};\n/,
  setSqlQueryReplacement.trim() + '\n'
);

// Add SaveQueryModal and QueryLibraryModal to JSX
const modalsHtml = `
      {/* Modals */}
      <QueryLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        savedQueries={savedQueries}
        onOpenQuery={handleOpenLibraryQuery}
        onDeleteQuery={(id) => setSavedQueries(prev => prev.filter(q => q.id !== id))}
        onToggleFavorite={(id) => setSavedQueries(prev => prev.map(q => q.id === id ? { ...q, isFavorite: !q.isFavorite } : q))}
        onDuplicateQuery={(q) => {
          const newId = \`sq-\${Date.now()}\`;
          setSavedQueries(prev => [...prev, { ...q, id: newId, name: \`\${q.name} (Copy)\`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
        }}
      />
      <SaveQueryModal
        isOpen={saveModalState.isOpen}
        onClose={() => setSaveModalState({ isOpen: false, mode: 'save' })}
        onSave={handleSaveQuerySubmit}
        initialData={
          saveModalState.isOpen && activeTab?.savedQueryId
            ? savedQueries.find(q => q.id === activeTab.savedQueryId)
            : { name: activeTab?.name === \`Query \${tabCounter - 1}.sql\` || activeTab?.name.startsWith('Query ') ? '' : activeTab?.name }
        }
      />
`;
content = content.replace(
  "{/* Connection Modal */}",
  modalsHtml + "\n      {/* Connection Modal */}"
);

fs.writeFileSync('src/App.tsx', content);
