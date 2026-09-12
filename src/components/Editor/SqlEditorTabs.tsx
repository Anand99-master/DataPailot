import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Edit2, Copy, FileText, Check } from 'lucide-react';
import { SqlEditorTab } from '../../types/database';

interface SqlEditorTabsProps {
  tabs: SqlEditorTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabAdd: () => void;
  onTabRename: (id: string, newName: string) => void;
  onTabDuplicate: (id: string) => void;
}

export const SqlEditorTabs: React.FC<SqlEditorTabsProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabAdd,
  onTabRename,
  onTabDuplicate
}) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleStartRename = (e: React.MouseEvent, tab: SqlEditorTab) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditName(tab.name);
  };

  const handleFinishRename = () => {
    if (editingTabId) {
      const name = editName.trim() || 'Query';
      onTabRename(editingTabId, name);
      setEditingTabId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFinishRename();
    if (e.key === 'Escape') setEditingTabId(null);
  };

  return (
    <div className="flex items-center bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar select-none">
      <div className="flex items-center flex-1 min-w-0">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isEditing = editingTabId === tab.id;

          return (
            <div
              key={tab.id}
              onClick={() => !isEditing && onTabSelect(tab.id)}
              className={`group flex items-center h-10 px-3 border-r border-slate-800 min-w-[120px] max-w-[200px] cursor-pointer transition-colors ${
                isActive ? 'bg-slate-800 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 mr-2 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
              
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-slate-950 text-white text-xs px-1.5 py-0.5 rounded outline-none border border-indigo-500 min-w-0"
                />
              ) : (
                <span className="flex-1 text-xs truncate mr-2" title={tab.name}>
                  {tab.name}{tab.isModified ? ' *' : ''}
                  {tab.isRunning && <span className="ml-2 text-amber-400 animate-pulse">●</span>}
                </span>
              )}

              {!isEditing && (
                <div className={`flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${isActive ? 'opacity-100' : ''}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onTabDuplicate(tab.id); }}
                    className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-slate-700 rounded transition-colors"
                    title="Duplicate tab"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleStartRename(e, tab)}
                    className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-slate-700 rounded transition-colors"
                    title="Rename tab"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-700 rounded transition-colors"
                    title="Close tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={onTabAdd}
        className="flex items-center justify-center h-10 px-3 text-slate-400 hover:text-white hover:bg-slate-800 border-l border-slate-800 transition-colors flex-shrink-0"
        title="New tab"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
