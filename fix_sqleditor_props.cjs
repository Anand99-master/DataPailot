const fs = require('fs');
let content = fs.readFileSync('src/components/Editor/SqlEditor.tsx', 'utf8');

// Ensure Activity import is actually there, if not add it.
if (!content.includes('Activity,')) {
  content = content.replace("CheckCircle2,", "CheckCircle2,\n  Activity,");
}

// Ensure onAnalyzePerformance is in props
if (!content.includes('onAnalyzePerformance?: (sql: string) => void;')) {
  content = content.replace("onExplainSql?: (sql: string) => void;", "onExplainSql?: (sql: string) => void;\n  onAnalyzePerformance?: (sql: string) => void;");
}

if (!content.includes('onAnalyzePerformance,\n  isRunning')) {
  content = content.replace("onExplainSql,\n  isRunning", "onExplainSql,\n  onAnalyzePerformance,\n  isRunning");
}

fs.writeFileSync('src/components/Editor/SqlEditor.tsx', content);
