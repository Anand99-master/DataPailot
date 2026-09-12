import { analyzePlan } from '../src/utils/performanceParser';
import { PlanNode } from '../src/types/performance';
import { QuerySafetyValidator } from '../server/database/QuerySafetyValidator';

export function runPerformanceAnalyzerTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: errorMsg });
    }
  };

  const samplePlan: PlanNode = {
    "Node Type": "Limit",
    "Startup Cost": 0.0,
    "Total Cost": 0.1,
    "Plan Rows": 10,
    "Plans": [
      {
        "Node Type": "Seq Scan",
        "Relation Name": "large_table",
        "Startup Cost": 0.0,
        "Total Cost": 5000.0,
        "Plan Rows": 2000000
      }
    ]
  };

  const analysis = analyzePlan(samplePlan, 'SELECT * FROM large_table LIMIT 10;');

  assertTest('Parse sequential scan', analysis.summary.primaryScan === 'Seq Scan', 'Failed to detect Seq Scan');
  assertTest('Parse high rows warning', analysis.warnings.some(w => w.includes('potentially large table') || w.includes('High estimated row count')), 'Failed to warn about large table seq scan');
  assertTest('Total cost extraction', analysis.summary.totalCost === 0.1, 'Failed to extract total cost');

  // Test read-only EXPLAIN validation
  const validExplain = QuerySafetyValidator.validate("EXPLAIN (FORMAT JSON) SELECT * FROM test;");
  assertTest('Read-only EXPLAIN allowed', validExplain.isValid, 'Failed to allow safe EXPLAIN');

  const invalidExplain = QuerySafetyValidator.validate("EXPLAIN (FORMAT JSON) DELETE FROM test;");
  assertTest('Mutating EXPLAIN blocked', !invalidExplain.isValid, 'Failed to block mutating EXPLAIN');

  const analyzeExplain = QuerySafetyValidator.validate("EXPLAIN ANALYZE SELECT * FROM test;");
  assertTest('EXPLAIN ANALYZE blocked', !analyzeExplain.isValid, 'Failed to block EXPLAIN ANALYZE');

  return results;
}
