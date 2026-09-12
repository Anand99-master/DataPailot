const fs = require('fs');

let content = fs.readFileSync('src/components/Editor/SqlEditor.tsx', 'utf8');

// Add imports
content = content.replace(
  "import { QueryExecutionResult, QueryHistoryItem } from '../../types/database';",
  `import { QueryExecutionResult, QueryHistoryItem, DiscoveredTable, TableDetailsResult } from '../../types/database';\nimport { getSuggestions, Suggestion } from '../../utils/sqlAutocomplete';\nimport { getCaretCoordinates } from '../../utils/caretCoordinates';\nimport { SqlAutocomplete } from './SqlAutocomplete';`
);

// Add props
content = content.replace(
  "onClearHistory?: () => void;",
  "onClearHistory?: () => void;\n  tables?: DiscoveredTable[];\n  tableDetailsCache?: Record<string, TableDetailsResult>;"
);

content = content.replace(
  "onClearHistory\n}) => {",
  "onClearHistory,\n  tables = [],\n  tableDetailsCache = {}\n}) => {"
);

// Add state
const stateCode = `
  const [activeTab, setActiveTab] = useState('query-1');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caretPos, setCaretPos] = useState({ top: 0, left: 0 });
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [currentFilter, setCurrentFilter] = useState('');

  const updateSuggestions = (val: string, cursor: number, forceOpen = false) => {
    const { suggestions: newSugs, prefix, filterText } = getSuggestions(val, cursor, tables, tableDetailsCache);
    if (newSugs.length > 0 && (filterText.length > 0 || forceOpen || prefix.length > 0)) {
      setSuggestions(newSugs);
      setSelectedIndex(0);
      setCurrentPrefix(prefix);
      setCurrentFilter(filterText);
      setIsAutocompleteOpen(true);
      
      if (textareaRef.current) {
        const coords = getCaretCoordinates(textareaRef.current, cursor);
        // adjust coords based on textarea scroll
        coords.top -= textareaRef.current.scrollTop;
        coords.left -= textareaRef.current.scrollLeft;
        setCaretPos(coords);
      }
    } else {
      setIsAutocompleteOpen(false);
    }
  };

  const insertSuggestion = (suggestion: Suggestion) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const textBefore = query.substring(0, cursor);
    const textAfter = query.substring(cursor);
    
    // determine what to replace
    let replacement = suggestion.name;
    if (suggestion.name.includes(' ') && suggestion.type !== 'keyword') {
      replacement = \`"\${suggestion.name}"\`;
    }
    
    let newBefore = textBefore;
    if (currentFilter.length > 0) {
      newBefore = newBefore.slice(0, -currentFilter.length);
    }
    
    const newQuery = newBefore + replacement + textAfter;
    onChangeQuery(newQuery);
    setIsAutocompleteOpen(false);
    
    // Set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursor = newBefore.length + replacement.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };
`;

content = content.replace(
  /const \[activeTab, setActiveTab\] = useState\('query-1'\);\s*const \[isHistoryOpen, setIsHistoryOpen\] = useState\(false\);\s*const textareaRef = useRef<HTMLTextAreaElement>\(null\);\s*const historyMenuRef = useRef<HTMLDivElement>\(null\);/,
  stateCode
);

const handleKeyDownReplacement = `
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isAutocompleteOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAutocompleteOpen(false);
        return;
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isRunning && query.trim()) {
        onRunQuery();
      }
      return;
    }
    
    if ((e.metaKey || e.ctrlKey) && e.key === ' ') {
      e.preventDefault();
      updateSuggestions(query, e.currentTarget.selectionStart, true);
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChangeQuery(e.target.value);
    updateSuggestions(e.target.value, e.target.selectionStart);
  };
  
  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    setIsAutocompleteOpen(false);
  };
  
  const handleBlur = () => {
    // delay to allow click on autocomplete list
    setTimeout(() => {
      setIsAutocompleteOpen(false);
    }, 150);
  };
`;

content = content.replace(
  /const handleKeyDown = \(e: React\.KeyboardEvent<HTMLTextAreaElement>\) => \{[\s\S]*?\}\s*\};/,
  handleKeyDownReplacement
);

content = content.replace(
  /onChange=\{e => onChangeQuery\(e\.target\.value\)\}/,
  "onChange={handleChange}\n            onClick={handleClick}\n            onBlur={handleBlur}"
);

content = content.replace(
  /<textarea/,
  "{isAutocompleteOpen && (\n            <SqlAutocomplete\n              suggestions={suggestions}\n              selectedIndex={selectedIndex}\n              onSelect={insertSuggestion}\n              position={caretPos}\n            />\n          )}\n          <textarea"
);


fs.writeFileSync('src/components/Editor/SqlEditor.tsx', content);
