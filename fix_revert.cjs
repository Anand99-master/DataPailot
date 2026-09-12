const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

appContent = appContent.replace(
  "isModified={!!activeTab?.isModified}",
  "isModified={!!activeTab?.isModified}\n                    onRevertQuery={() => {\n                      if (activeTab?.savedQueryId) {\n                        const sq = savedQueries.find(q => q.id === activeTab.savedQueryId);\n                        if (sq) setSqlQuery(sq.query);\n                      }\n                    }}"
);

fs.writeFileSync('src/App.tsx', appContent);

let editorContent = fs.readFileSync('src/components/Editor/SqlEditor.tsx', 'utf8');
editorContent = editorContent.replace(
  "isModified?: boolean;\n}",
  "isModified?: boolean;\n  onRevertQuery?: () => void;\n}"
);

editorContent = editorContent.replace(
  "isSaved,\n  isModified\n}) => {",
  "isSaved,\n  isModified,\n  onRevertQuery\n}) => {"
);

const newRevertBtn = `              {isSaved && onSaveAsQuery && (
                <button
                  type="button"
                  onClick={onSaveAsQuery}
                  className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                  title="Save As New Query"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Save As</span>
                </button>
              )}
              {isSaved && isModified && onRevertQuery && (
                <button
                  type="button"
                  onClick={onRevertQuery}
                  className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors"
                  title="Revert to saved query"
                >
                  <span>Revert</span>
                </button>
              )}`;

editorContent = editorContent.replace(
  `              {isSaved && onSaveAsQuery && (
                <button
                  type="button"
                  onClick={onSaveAsQuery}
                  className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                  title="Save As New Query"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Save As</span>
                </button>
              )}`,
  newRevertBtn
);

fs.writeFileSync('src/components/Editor/SqlEditor.tsx', editorContent);

