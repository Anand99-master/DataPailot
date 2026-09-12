const fs = require('fs');
let content = fs.readFileSync('src/components/Editor/SqlEditor.tsx', 'utf8');

// Add to props interface
content = content.replace(
  "tableDetailsCache?: Record<string, TableDetailsResult>;\n}",
  "tableDetailsCache?: Record<string, TableDetailsResult>;\n  onSaveQuery?: () => void;\n  onSaveAsQuery?: () => void;\n  onOpenLibrary?: () => void;\n  isSaved?: boolean;\n  isModified?: boolean;\n}"
);

// Add to component destructuring
content = content.replace(
  "tableDetailsCache = {}\n}) => {",
  "tableDetailsCache = {},\n  onSaveQuery,\n  onSaveAsQuery,\n  onOpenLibrary,\n  isSaved,\n  isModified\n}) => {"
);

// Remove the FileCode2 block, replace with Save/Library actions
const oldHeaderBlock = `
      <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-3 py-1.5 select-none">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('query-1')}
            className={\`flex items-center space-x-1.5 px-3 py-1 text-xs rounded font-medium transition-colors \${
              activeTab === 'query-1'
                ? 'bg-slate-950 text-slate-100 border border-slate-800'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }\`}
          >
            <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Query 1.sql</span>
          </button>
        </div>
`;
const newHeaderBlock = `
      <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-3 py-1.5 select-none">
        <div className="flex items-center space-x-2">
          {onOpenLibrary && (
            <button
              type="button"
              onClick={onOpenLibrary}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Query Library"
            >
              <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Library</span>
            </button>
          )}
          
          {(onSaveQuery || onSaveAsQuery) && (
            <div className="flex items-center space-x-1 ml-2 border-l border-slate-700 pl-2">
              <button
                type="button"
                onClick={onSaveQuery}
                className={\`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors \${
                   isSaved && !isModified ? 'text-slate-500 cursor-default' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }\`}
                disabled={isSaved && !isModified}
                title={isSaved && !isModified ? "Saved" : "Save Query"}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
              {isSaved && onSaveAsQuery && (
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
            </div>
          )}
        </div>
`;

// Also I noticed Save and Copy are not imported.
content = content.replace(
  "import { Play, Eraser, AlignLeft, History, FileCode2, Info, StopCircle, ArrowDownToLine, Bot } from 'lucide-react';",
  "import { Play, Eraser, AlignLeft, History, FileCode2, Info, StopCircle, ArrowDownToLine, Bot, Save, Copy } from 'lucide-react';"
);

content = content.replace(oldHeaderBlock, newHeaderBlock);

fs.writeFileSync('src/components/Editor/SqlEditor.tsx', content);
