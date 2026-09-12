import React, { useState, useMemo } from 'react';
import { X, Search, Star, Clock, FileText, Copy, Trash2, Tag, Play } from 'lucide-react';
import { SavedQuery } from '../../types/database';

interface QueryLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedQueries: SavedQuery[];
  onOpenQuery: (query: SavedQuery) => void;
  onDeleteQuery: (id: string) => void;
  onDuplicateQuery: (query: SavedQuery) => void;
  onToggleFavorite: (id: string) => void;
}

export const QueryLibraryModal: React.FC<QueryLibraryModalProps> = ({
  isOpen,
  onClose,
  savedQueries,
  onOpenQuery,
  onDeleteQuery,
  onDuplicateQuery,
  onToggleFavorite
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'nameAsc' | 'nameDesc' | 'favorites'>('updated');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    savedQueries.forEach(q => q.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [savedQueries]);

  const filteredAndSorted = useMemo(() => {
    let result = [...savedQueries];

    if (filterFavorite) {
      result = result.filter(q => q.isFavorite);
    }

    if (selectedTag) {
      result = result.filter(q => q.tags.includes(selectedTag));
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(q => 
        q.name.toLowerCase().includes(lower) || 
        q.description?.toLowerCase().includes(lower) ||
        q.query.toLowerCase().includes(lower) ||
        q.tags.some(t => t.toLowerCase().includes(lower))
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'favorites') {
        if (a.isFavorite === b.isFavorite) {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        return a.isFavorite ? -1 : 1;
      }
      switch (sortBy) {
        case 'updated': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'created': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'nameAsc': return a.name.localeCompare(b.name);
        case 'nameDesc': return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

    return result;
  }, [savedQueries, searchTerm, sortBy, filterFavorite, selectedTag]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Query Library</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Filters */}
          <div className="w-64 bg-slate-950/50 border-r border-slate-800 p-4 flex flex-col overflow-y-auto">
            <button
              onClick={() => { setFilterFavorite(false); setSelectedTag(null); }}
              className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm transition-colors ${!filterFavorite && !selectedTag ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-800/50'}`}
            >
              <FileText className="w-4 h-4" />
              <span>All Queries</span>
            </button>
            <button
              onClick={() => { setFilterFavorite(true); setSelectedTag(null); }}
              className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-sm transition-colors mt-1 ${filterFavorite && !selectedTag ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-300 hover:bg-slate-800/50'}`}
            >
              <Star className="w-4 h-4 text-amber-400" />
              <span>Favorites</span>
            </button>

            {allTags.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">Tags</h3>
                <div className="space-y-1">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => { setSelectedTag(tag); setFilterFavorite(false); }}
                      className={`flex items-center space-x-2 w-full px-3 py-1.5 rounded-md text-sm transition-colors ${selectedTag === tag ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span className="truncate">{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Search and Sort Bar */}
            <div className="p-4 border-b border-slate-800 flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search queries, descriptions, SQL..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-md pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 text-sm text-slate-300 rounded-md px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="updated">Recently Updated</option>
                <option value="created">Recently Created</option>
                <option value="nameAsc">Name (A-Z)</option>
                <option value="nameDesc">Name (Z-A)</option>
                <option value="favorites">Favorites First</option>
              </select>
            </div>

            {/* Query List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredAndSorted.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400">No saved queries found.</p>
                </div>
              ) : (
                filteredAndSorted.map(q => (
                  <div key={q.id} className="group bg-slate-950/50 border border-slate-800 hover:border-indigo-500/50 rounded-lg p-4 transition-colors flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3 min-w-0">
                        <button
                          onClick={() => onToggleFavorite(q.id)}
                          className={`p-1 -ml-1 rounded-full transition-colors ${q.isFavorite ? 'text-amber-400 hover:bg-amber-400/10' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'}`}
                        >
                          <Star className={`w-5 h-5 ${q.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                        <h3 className="text-base font-medium text-white truncate cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => onOpenQuery(q)}>
                          {q.name}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onDuplicateQuery(q)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete "${q.name}"?`)) {
                              onDeleteQuery(q.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenQuery(q)}
                          className="p-1.5 ml-2 text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/40 rounded transition-colors flex items-center space-x-1"
                        >
                          <Play className="w-4 h-4" />
                          <span className="text-xs font-medium pr-1">Open</span>
                        </button>
                      </div>
                    </div>
                    {q.description && (
                      <p className="text-sm text-slate-400 mb-3 line-clamp-2">{q.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-800/50">
                      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
                        {q.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center text-xs text-slate-500 flex-shrink-0 ml-4">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Updated {new Date(q.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
