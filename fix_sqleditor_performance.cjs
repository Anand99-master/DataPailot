const fs = require('fs');
let content = fs.readFileSync('src/components/Editor/SqlEditor.tsx', 'utf8');

// Add onAnalyzePerformance to props
content = content.replace(
  "onExplainSql?: (sql: string) => void;",
  "onExplainSql?: (sql: string) => void;\n  onAnalyzePerformance?: (sql: string) => void;"
);

content = content.replace(
  "onExplainSql,\n  isRunning",
  "onExplainSql,\n  onAnalyzePerformance,\n  isRunning"
);

// Add Activity icon import
content = content.replace(
  "CheckCircle2,",
  "CheckCircle2,\n  Activity,"
);

// Add Analyze Performance button before Explain SQL button
const explainBtnRegex = /\{\/\* Explain SQL Button \*\/\}/;
// Wait, is there an "Explain SQL Button" comment? Let's check.
