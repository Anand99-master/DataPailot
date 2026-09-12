const fs = require('fs');
let content = fs.readFileSync('src/components/Editor/SqlEditor.tsx', 'utf8');

const analyzeBtn = `
          {onAnalyzePerformance && (
            <button
              onClick={() => onAnalyzePerformance(query)}
              disabled={!query.trim() || isRunning}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-amber-300 hover:text-white bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/60 rounded transition-colors disabled:opacity-40"
              title="Analyze Query Performance"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Performance</span>
            </button>
          )}
`;

content = content.replace(
  "{onExplainSql && (",
  analyzeBtn + "\n          {onExplainSql && ("
);

fs.writeFileSync('src/components/Editor/SqlEditor.tsx', content);
