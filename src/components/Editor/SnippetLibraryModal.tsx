import React, { useState, useMemo } from 'react';
import { X, Search, Star, FileCode2, Copy, Trash2, Edit2, Play, Plus, BookTemplate } from 'lucide-react';
import { SqlSnippet, DiscoveredTable, TableDetailsResult } from '../../types/database';
import { useSnippets } from '../../hooks/useSnippets';

interface SnippetLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (sql: string) => void;
  tables?: DiscoveredTable[];
  tableDetailsCache?: Record<string, TableDetailsResult>;
}

export const SnippetLibraryModal: React.FC<SnippetLibraryModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  tables = [],
  tableDetailsCache = {}
}) => {
  const { snippets, toggleFavorite, addSnippet, updateSnippet, deleteSnippet } = useSnippets();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterFavorite, setFilterFavorite] = useState(false);

  // Custom snippet editing state
  const [editingSnippet, setEditingSnippet] = useState<Partial<SqlSnippet> | null>(null);

  // Configuration state for placeholders
  const [configuringSnippet, setConfiguringSnippet] = useState<SqlSnippet | null>(null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});

  const categories = useMemo(() => {
    const cats = new Set<string>();
    snippets.forEach(s => cats.add(s.category));
    return Array.from(cats).sort();
  }, [snippets]);

  const filteredSnippets = useMemo(() => {
    let result = [...snippets];

    if (filterFavorite) {
      result = result.filter(s => s.isFavorite);
    }

    if (selectedCategory) {
      result = result.filter(s => s.category === selectedCategory);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(lower) || 
        s.description.toLowerCase().includes(lower) ||
        s.sql.toLowerCase().includes(lower) ||
        s.category.toLowerCase().includes(lower) ||
        (s.prefix && s.prefix.toLowerCase().includes(lower))
      );
    }

    return result;
  }, [snippets, searchTerm, filterFavorite, selectedCategory]);

  const handleStartInsert = (snippet: SqlSnippet) => {
    // Check for placeholders
    const placeholders = snippet.sql.match(/\{\{([^}]+)\}\}/g);
    if (placeholders && placeholders.length > 0) {
      const initialValues: Record<string, string> = {};
      
      // Auto-populate with first table if available
      const defaultTable = tables[0]?.name || '';
      const defaultTableSchema = tables[0]?.schema === 'public' ? defaultTable : (tables[0] ? `"${tables[0].schema}"."${tables[0].name}"` : '');
      
      placeholders.forEach(p => {
        const key = p.replace(/[{}]/g, '');
        if (key.includes('table')) {
          initialValues[key] = defaultTableSchema;
        } else {
          initialValues[key] = '';
        }
      });
      setPlaceholderValues(initialValues);
      setConfiguringSnippet(snippet);
    } else {
      onInsert(snippet.sql);
      onClose();
    }
  };

  const handleConfirmInsert = () => {
    if (!configuringSnippet) return;
    let finalSql = configuringSnippet.sql;
    Object.entries(placeholderValues).forEach(([key, value]) => {
      finalSql = finalSql.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || key);
    });
    onInsert(finalSql);
    setConfiguringSnippet(null);
    onClose();
  };

  const handleSaveCustom = () => {
    if (editingSnippet && editingSnippet.name && editingSnippet.sql) {
      // Reject mutating SQL
      const isMutating = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|TRUNCATE)\b/i.test(editingSnippet.sql);
      if (isMutating) {
        alert("Custom snippets containing administrative or mutating SQL are not allowed due to read-only guard policies.");
        return;
      }
      
      if (editingSnippet.id) {
        updateSnippet(editingSnippet.id, editingSnippet);
      } else {
        addSnippet(editingSnippet as any);
      }
      setEditingSnippet(null);
    }
  };

  // Helper for rendering dropdowns for variables
  const renderVariableInput = (key: string, value: string) => {
    if (key.includes('table') && tables.length > 0) {
      return (
        <select
          value={value}
          onChange={e => setPlaceholderValues(prev => ({ ...prev, [key]: e.target.value }))}
          className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-md px-3 py-2"
        >
          <option value="">Select a table...</option>
          {tables.map(t => {
            const val = t.schema === 'public' ? t.name : `"${t.schema}"."${t.name}"`;
            return <option key={val} value={val}>{val}</option>;
          })}
        </select>
      );
    }
    
    // For column, if we have a table selected in placeholderValues, try to show its columns
    const tableKey = Object.keys(placeholderValues).find(k => k.includes('table'));
    if (tableKey && placeholderValues[tableKey]) {
      const tableName = placeholderValues[tableKey].replace(/"/g, ''); // simplified
      // find in cache
      const cacheKey = Object.keys(tableDetailsCache).find(k => k.endsWith(tableName));
      if (cacheKey && tableDetailsCache[cacheKey]) {
        return (
          <select
            value={value}
            onChange={e => setPlaceholderValues(prev => ({ ...prev, [key]: e.target.value }))}
            className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-md px-3 py-2"
          >
            <option value="">Select a column...</option>
            {tableDetailsCache[cacheKey].columns.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        );
      }
    }

    return (
      <input
        type="text"
        value={value}
        onChange={e => setPlaceholderValues(prev => ({ ...prev, [key]: e.target.value }))}
        className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-md px-3 py-2"
        placeholder={`Enter ${key}...`}
      />
    );
  };

  if (!isOpen) return null;

  if (configuringSnippet) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Configure Snippet Variables</h2>
            <button onClick={() => setConfiguringSnippet(null)} className="p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            {Object.keys(placeholderValues).map(key => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-300 mb-1">{key}</label>
                {renderVariableInput(key, placeholderValues[key])}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-800 flex justify-end space-x-3 bg-slate-900/50">
            <button onClick={() => setConfiguringSnippet(null)} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded border border-slate-700">Cancel</button>
            <button onClick={handleConfirmInsert} className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded">Insert</button>
          </div>
        </div>
      </div>
    );
  }

  if (editingSnippet) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">{editingSnippet.id ? 'Edit' : 'New'} Snippet</h2>
            <button onClick={() => setEditingSnippet(null)} className="p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
              <input type="text" value={editingSnippet.name || ''} onChange={e => setEditingSnippet(p => ({...p!, name: e.target.value}))} className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <input type="text" value={editingSnippet.description || ''} onChange={e => setEditingSnippet(p => ({...p!, description: e.target.value}))} className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded px-3 py-2" />
            </div>
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                <input type="text" value={editingSnippet.category || 'Custom'} onChange={e => setEditingSnippet(p => ({...p!, category: e.target.value}))} className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded px-3 py-2" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-300 mb-1">Prefix / Shortcut</label>
                <input type="text" value={editingSnippet.prefix || ''} onChange={e => setEditingSnippet(p => ({...p!, prefix: e.target.value}))} className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">SQL Template *</label>
              <textarea value={editingSnippet.sql || ''} onChange={e => setEditingSnippet(p => ({...p!, sql: e.target.value}))} rows={6} className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded px-3 py-2 font-mono" />
            </div>
          </div>
          <div className="p-4 border-t border-slate-800 flex justify-end space-x-3 bg-slate-900/50">
            <button onClick={() => setEditingSnippet(null)} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded border border-slate-700">Cancel</button>
            <button disabled={!editingSnippet.name || !editingSnippet.sql} onClick={handleSaveCustom} className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <BookTemplate className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">SQL Snippets</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 bg-slate-950/50 border-r border-slate-800 flex flex-col">
            <div className="p-3">
              <button
                onClick={() => setEditingSnippet({ category: 'Custom' })}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>New Snippet</span>
              </button>
            </div>
            <div className="overflow-y-auto p-3 flex-1">
              <button
                onClick={() => { setFilterFavorite(false); setSelectedCategory(null); }}
                className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm transition-colors ${!filterFavorite && !selectedCategory ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-800/50'}`}
              >
                <span>All Snippets</span>
              </button>
              <button
                onClick={() => { setFilterFavorite(true); setSelectedCategory(null); }}
                className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm transition-colors mt-1 ${filterFavorite && !selectedCategory ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-800/50'}`}
              >
                <Star className="w-4 h-4 text-amber-400" />
                <span>Favorites</span>
              </button>

              <div className="mt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">Categories</h3>
                <div className="space-y-1">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setFilterFavorite(false); }}
                      className={`flex items-center w-full px-3 py-1.5 rounded-md text-sm transition-colors ${selectedCategory === cat ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}`}
                    >
                      <span className="truncate">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search snippets..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-md pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredSnippets.map(s => (
                  <div key={s.id} className="group flex flex-col bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-3 transition-colors h-[120px]">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center min-w-0">
                        <button onClick={() => toggleFavorite(s.id)} className={`p-1 -ml-1 mr-1 rounded ${s.isFavorite ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>
                          <Star className={`w-4 h-4 ${s.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                        <h3 className="text-sm font-semibold text-white truncate">{s.name}</h3>
                        {!s.isCustom && <span className="ml-2 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Built-in</span>}
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {s.isCustom && (
                          <>
                            <button onClick={() => setEditingSnippet(s)} className="p-1 text-slate-400 hover:text-indigo-400"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingSnippet({ ...s, id: undefined, name: `${s.name} (Copy)` })} className="p-1 text-slate-400 hover:text-emerald-400"><Copy className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { if(window.confirm('Delete snippet?')) deleteSnippet(s.id); }} className="p-1 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                        <button onClick={() => handleStartInsert(s)} className="flex items-center px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded">
                          <Play className="w-3 h-3 mr-1" /> Insert
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-2 line-clamp-2 flex-1">{s.description}</p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>{s.category}</span>
                      {s.prefix && <span className="font-mono bg-slate-950 px-1 rounded border border-slate-800">/{s.prefix}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
