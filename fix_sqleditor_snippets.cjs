const fs = require('fs');
let content = fs.readFileSync('src/components/Editor/SqlEditor.tsx', 'utf8');

content = content.replace(
  "import { SqlAutocomplete } from './SqlAutocomplete';",
  "import { SqlAutocomplete } from './SqlAutocomplete';\nimport { SnippetLibraryModal } from './SnippetLibraryModal';\nimport { BookTemplate } from 'lucide-react';"
);

content = content.replace(
  "const [isHistoryOpen, setIsHistoryOpen] = useState(false);",
  "const [isHistoryOpen, setIsHistoryOpen] = useState(false);\n  const [isSnippetsOpen, setIsSnippetsOpen] = useState(false);"
);

// Keyboard shortcut
const keydownReplacement = `
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl + Shift + Space for Snippets
    if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
      e.preventDefault();
      setIsSnippetsOpen(true);
      return;
    }
`;

content = content.replace(
  "const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {",
  keydownReplacement.trim()
);

// Toolbar button
const libraryBtnRegex = /\{\/\* Query History Dropdown \*\/\}/;
const snippetBtnStr = `
          {/* Snippets Button */}
          <button
            type="button"
            onClick={() => setIsSnippetsOpen(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 rounded transition-colors"
            title="SQL Snippets (Ctrl+Shift+Space)"
          >
            <BookTemplate className="w-3.5 h-3.5 text-emerald-400" />
            <span>Snippets</span>
          </button>
          
          {/* Query History Dropdown */}`;
content = content.replace(libraryBtnRegex, snippetBtnStr);

// Insert Snippet logic
const insertSnippetFunc = `
  const insertSnippet = (snippetSql: string) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const textBefore = query.substring(0, cursor);
    const textAfter = query.substring(cursor);
    
    // Ensure we have some spacing if not at start of line
    const needsNewlineBefore = textBefore.length > 0 && !textBefore.endsWith('\\n');
    const prefix = needsNewlineBefore ? '\\n' : '';
    
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
`;

content = content.replace(
  "const insertSuggestion = (suggestion: Suggestion) => {",
  insertSnippetFunc + "\n  const insertSuggestion = (suggestion: Suggestion) => {"
);

// Render modal
content = content.replace(
  "id=\"sql-editor-panel\"",
  "id=\"sql-editor-panel\""
);

// Wait, I will just append the modal at the end of the return statement, before the last </div>
const modalComponent = `
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
`;

content = content.replace(
  /<\/div>\s*\);\s*\};\s*$/,
  modalComponent
);

fs.writeFileSync('src/components/Editor/SqlEditor.tsx', content);
