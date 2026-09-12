const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Imports
content = content.replace(
  "import { ErrorBoundary } from './components/common/ErrorBoundary';",
  "import { ErrorBoundary } from './components/common/ErrorBoundary';\nimport { PerformanceAnalyzerModal } from './components/Editor/PerformanceAnalyzerModal';\nimport { PerformanceAnalysis } from './types/performance';\nimport { analyzePlan } from './utils/performanceParser';"
);

// State
const stateToAdd = `
  // Performance Analyzer State
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [currentPerformanceAnalysis, setCurrentPerformanceAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceAnalysis[]>(() => {
    try {
      const saved = localStorage.getItem('datapilot_performance_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('datapilot_performance_history', JSON.stringify(performanceHistory.slice(0, 10))); // keep last 10
  }, [performanceHistory]);

  const handleAnalyzePerformance = async (sql: string) => {
    setIsPerformanceModalOpen(true);
    setCurrentPerformanceAnalysis(null);
    try {
      // Execute safe EXPLAIN (FORMAT JSON)
      const explainSql = \`EXPLAIN (FORMAT JSON) \${sql}\`;
      const result = await DatabaseApiClient.executeQuery(sessionId, explainSql);
      
      if (result.error) {
        alert(\`Performance Analysis Error: \${result.error}\`);
        setIsPerformanceModalOpen(false);
        return;
      }
      
      if (result.rows && result.rows.length > 0) {
        let planData = result.rows[0];
        // The json is usually in the first column
        const planKey = Object.keys(planData)[0];
        const planArray = planData[planKey];
        if (Array.isArray(planArray) && planArray.length > 0 && planArray[0].Plan) {
          const analysis = analyzePlan(planArray[0].Plan, sql, tableDetailsCache);
          setCurrentPerformanceAnalysis(analysis);
          setPerformanceHistory(prev => [analysis, ...prev]);
        } else {
          alert('Could not parse EXPLAIN JSON result.');
          setIsPerformanceModalOpen(false);
        }
      } else {
        alert('No plan returned from database.');
        setIsPerformanceModalOpen(false);
      }
    } catch (err: any) {
      alert(\`Analysis Failed: \${err.message}\`);
      setIsPerformanceModalOpen(false);
    }
  };
`;

content = content.replace(
  "const [dashboardLayout, setDashboardLayout]",
  stateToAdd + "\n  const [dashboardLayout, setDashboardLayout]"
);

// Prop in SqlEditor
content = content.replace(
  "onExplainSql={handleExplainSql}",
  "onExplainSql={handleExplainSql}\n              onAnalyzePerformance={handleAnalyzePerformance}"
);

// Component in return
const componentToAdd = `
      <PerformanceAnalyzerModal
        isOpen={isPerformanceModalOpen}
        onClose={() => setIsPerformanceModalOpen(false)}
        analysis={currentPerformanceAnalysis}
        history={performanceHistory}
        tables={tables}
        tableDetailsCache={tableDetailsCache}
      />
`;

content = content.replace(
  "<QueryLibraryModal",
  componentToAdd + "\n      <QueryLibraryModal"
);

fs.writeFileSync('src/App.tsx', content);
