const fs = require('fs');
let content = fs.readFileSync('src/components/Header/Navbar.tsx', 'utf8');
content = content.replace(
  "activeView?: 'editor' | 'analysis' | 'visualization' | 'dashboards';",
  "activeView?: 'editor' | 'analysis' | 'visualization' | 'dashboards' | 'lineage';"
);
content = content.replace(
  "onViewChange?: (view: 'editor' | 'analysis' | 'visualization' | 'dashboards') => void;",
  "onViewChange?: (view: 'editor' | 'analysis' | 'visualization' | 'dashboards' | 'lineage') => void;"
);

const lineageBtn = `
          <button
            id="tab-btn-lineage"
            onClick={() => onViewChange('lineage')}
            className={\`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all \${
              activeView === 'lineage'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }\`}
          >
            <Database className="w-3.5 h-3.5 text-amber-300" />
            <span>Lineage</span>
          </button>
`;
content = content.replace(
  "<button\n            id=\"tab-btn-dashboards\"",
  lineageBtn + "          <button\n            id=\"tab-btn-dashboards\""
);
fs.writeFileSync('src/components/Header/Navbar.tsx', content);
