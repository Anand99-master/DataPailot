import { runComprehensiveTestMatrix } from './testPhase12Matrix';
import { runSQLiteConnectionTests } from './testSQLiteConnection';
import { runDataLineageTests } from './testDataLineage';
import { runSqlSecurityTests } from './testSqlSecurity';
import { runSchemaAndGroundingTests } from './testSchemaAndGrounding';
import { runDashboardAndFilterTests } from './testDashboardAndFilters';
import { runDatabaseAdapterTests } from './testDatabaseAdapter';
import { runDatabaseAdapterTests as runAdapterFoundationTests } from './runDatabaseAdapterTests';
import { runSqlAutocompleteTests } from './testSqlAutocomplete';
import { runSqlEditorTabsTests } from './testSqlEditorTabs';
import { runQueryLibraryTests } from './testQueryLibrary';
import { runSqlSnippetsTests } from './testSqlSnippets';
import { runPerformanceAnalyzerTests } from './testPerformanceAnalyzer';
import { runImportWorkflowTests } from './testImportWorkflow';
import { runVisualizationImportIntegrationTests } from './testVisualizationImportIntegration';
import { runExcelExportTests } from './testExcelExport';
import { runDataQualityTests } from './testDataQuality';
import { runDataQualitySelectionTests } from './testDataQualitySelection';
import { runDataTransformation15_2Tests } from './testDataTransformation15_2';
import { runAiDataCleaning15_5Tests } from './testAiDataCleaning15_5';
import { runLargeDatasetPerformance15_6Tests } from './testLargeDatasetPerformance15_6';
import { runPhase16_1Tests } from './testPhase16_1UiOptimization';

console.log('\n============================================================');
console.log('DATAPILOT PHASE 8: AUTOMATED TEST SUITE & REGRESSION MATRIX');
console.log('============================================================\n');

interface TestGroup {
  name: string;
  runner: () => any;
}

const suites: TestGroup[] = [
  { name: '0. DATA LINEAGE', runner: runDataLineageTests },
  { name: '0. PERFORMANCE ANALYZER', runner: runPerformanceAnalyzerTests },
  { name: '0. SQL SNIPPETS', runner: runSqlSnippetsTests },
  { name: '0. QUERY LIBRARY', runner: runQueryLibraryTests },
  { name: '0. SQL EDITOR TABS', runner: runSqlEditorTabsTests },
  { name: '0. SQL AUTOCOMPLETE', runner: runSqlAutocompleteTests },
  { name: '5. DATABASE ADAPTER FOUNDATION', runner: runAdapterFoundationTests  },
  { name: '1b. SQLITE CONNECTION VALIDATION', runner: runSQLiteConnectionTests },
  { name: '1. DATABASE & ADAPTER HARDENING', runner: runDatabaseAdapterTests },
  { name: '2. SQL SECURITY & REGRESSION MATRIX', runner: runSqlSecurityTests },
  { name: '3. SCHEMA GROUNDING & HALLUCINATION REJECTION', runner: runSchemaAndGroundingTests },
  { name: '4. DASHBOARD FILTERS & EXPORT SECURITY', runner: runDashboardAndFilterTests },
  { name: '12. PHASE 12 COMPREHENSIVE MATRIX', runner: runComprehensiveTestMatrix },
  { name: '13. DATA IMPORT & UNIFIED DATA LAYER', runner: runImportWorkflowTests },
  { name: '14. IMPORTED DATASET VISUALIZATION INTEGRATION', runner: runVisualizationImportIntegrationTests },
  { name: '15. EXCEL (XLSX) QUERY RESULT EXPORT', runner: runExcelExportTests },
  { name: '16. DATA QUALITY & PROFILING 2.0', runner: runDataQualityTests },
  { name: '17. DATA QUALITY WORKSPACE SELECTION', runner: runDataQualitySelectionTests },
  { name: '18. ADVANCED DATA TRANSFORMATION WORKSPACE (15.2)', runner: runDataTransformation15_2Tests },
  { name: '19. AI-ASSISTED DATA CLEANING & AUTO-CLEAN RECOMMENDATIONS (15.5)', runner: runAiDataCleaning15_5Tests },
  { name: '20. LARGE DATASET PERFORMANCE & PROCESSING ENGINE (15.6)', runner: runLargeDatasetPerformance15_6Tests },
  { name: '21. PHASE 16.1 UI/UX POLISH & SQL WORKSPACE OPTIMIZATION', runner: runPhase16_1Tests }
];

async function runAll() {
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

for (const suite of suites) {
  console.log(`\n--- ${suite.name} ---`);
  const results = await suite.runner();
  for (const res of results) {
    totalTests++;
    if (res.passed) {
      passedTests++;
      console.log(`  ✓ PASS: ${res.name}`);
    } else {
      failedTests++;
      console.error(`  ✗ FAIL: ${res.name} -> ${res.error || 'Check failed'}`);
    }
  }
}

console.log('\n============================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} failed)`);
console.log('============================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
}
runAll().catch(console.error);
