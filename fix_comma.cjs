const fs = require('fs');
let code = fs.readFileSync('tests/runAllTests.ts', 'utf8');
code = code.replace(
  "{ name: '4. DASHBOARD FILTERS & EXPORT SECURITY', runner: runDashboardAndFilterTests }\n  { name: '12. PHASE 12 COMPREHENSIVE MATRIX', runner: runComprehensiveTestMatrix }",
  "{ name: '4. DASHBOARD FILTERS & EXPORT SECURITY', runner: runDashboardAndFilterTests },\n  { name: '12. PHASE 12 COMPREHENSIVE MATRIX', runner: runComprehensiveTestMatrix }"
);
fs.writeFileSync('tests/runAllTests.ts', code);
