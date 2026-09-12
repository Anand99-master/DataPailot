import React, { useEffect, useRef } from 'react';
import { Suggestion } from '../../utils/sqlAutocomplete';
import { Type, Box, FunctionSquare, KeySquare, Hash } from 'lucide-react';

interface SqlAutocompleteProps {
  suggestions: Suggestion[];
  selectedIndex: number;
  onSelect: (suggestion: Suggestion) => void;
  position: { top: number; left: number };
}

export const SqlAutocomplete: React.FC<SqlAutocompleteProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  position
}) => {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (suggestions.length === 0) return null;

  return (
    <div
      className="absolute z-50 bg-slate-800 border border-slate-700 rounded-md shadow-2xl overflow-hidden font-mono text-xs w-64"
      style={{ top: position.top + 20, left: position.left }}
    >
      <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
        {suggestions.map((s, idx) => {
          const isSelected = idx === selectedIndex;
          
          let Icon = Box;
          let iconColor = 'text-slate-400';
          if (s.type === 'table') {
            Icon = Box;
            iconColor = 'text-indigo-400';
          } else if (s.type === 'column') {
            Icon = Hash;
            iconColor = 'text-emerald-400';
          } else if (s.type === 'keyword') {
            Icon = KeySquare;
            iconColor = 'text-rose-400';
          } else if (s.type === 'function') {
            Icon = FunctionSquare;
            iconColor = 'text-sky-400';
          } else if (s.type === 'alias') {
            Icon = Type;
            iconColor = 'text-amber-400';
          }
          
          return (
            <li
              key={`${s.type}-${s.name}`}
              className={`px-3 py-1.5 cursor-pointer flex items-center justify-between ${
                isSelected ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                onSelect(s);
              }}
            >
              <div className="flex items-center space-x-2 truncate">
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
                <span className="truncate">{s.name}</span>
              </div>
              {s.detail && (
                <span className="text-[10px] text-slate-500 ml-2 flex-shrink-0">{s.detail}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
