import React, { useState, useEffect, useRef } from 'react';
import { CollaborationApiClient } from '../../services/collaborationApi';
import { SearchResultItem } from '../../types/collaboration';
import { Search, X, Code2, LayoutDashboard, FileText, Database, FolderKanban, ArrowRight } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResource: (type: string, id: string, name: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectResource
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await CollaborationApiClient.search(query.trim());
        if (res.success) {
          setResults(res.results);
        }
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'query':
        return <Code2 className="w-4 h-4 text-indigo-400" />;
      case 'dashboard':
        return <LayoutDashboard className="w-4 h-4 text-emerald-400" />;
      case 'report':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'dataset':
        return <Database className="w-4 h-4 text-purple-400" />;
      case 'project':
        return <FolderKanban className="w-4 h-4 text-amber-400" />;
      default:
        return <Search className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div
      ref={backdropRef}
      id="global-search-backdrop"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global Workspace Search"
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden text-slate-100 flex flex-col"
      >
        {/* Search Input Header */}
        <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950/60">
          <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search queries, dashboards, reports, datasets, projects..."
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden"
            aria-label="Search queries, dashboards, reports, datasets, projects"
          />

          {/* Clear Query Button (only when text is present) */}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors mr-2 flex-shrink-0"
              title="Clear search query"
              aria-label="Clear search input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* ESC badge */}
          <kbd
            onClick={onClose}
            title="Press ESC to close"
            className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded border border-slate-700 select-none cursor-pointer hover:bg-slate-750 hover:text-slate-300 transition-colors mr-1 flex-shrink-0"
          >
            ESC
          </kbd>

          {/* Dedicated Close Button */}
          <button
            id="btn-close-global-search"
            type="button"
            onClick={onClose}
            aria-label="Close search"
            title="Close search"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-600 transition-colors flex-shrink-0 ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Box */}
        <div className="max-h-96 overflow-y-auto p-2">
          {isSearching && (
            <div className="p-8 text-center text-xs text-slate-400">
              Searching workspace...
            </div>
          )}

          {!isSearching && query.trim() && results.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching resources found for "{query}".
            </div>
          )}

          {!isSearching && !query.trim() && (
            <div className="p-8 text-center text-xs text-slate-500">
              Type keywords to search across SQL queries, dashboards, datasets, and reports.
            </div>
          )}

          <div className="space-y-1">
            {results.map(r => (
              <button
                key={`${r.type}_${r.id}`}
                onClick={() => {
                  onSelectResource(r.type, r.id, r.title);
                  onClose();
                }}
                className="w-full p-2.5 rounded-lg flex items-center justify-between hover:bg-slate-800/80 transition-colors text-left group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex-shrink-0">
                    {getTypeIcon(r.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
                        {r.title}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        {r.type}
                      </span>
                    </div>
                    {r.subtitle && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {r.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
