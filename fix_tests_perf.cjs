const fs = require('fs');
let content = fs.readFileSync('tests/runAllTests.ts', 'utf8');

if (!content.includes('runPerformanceAnalyzerTests')) {
    content = content.replace(
        "import { runSqlSnippetsTests } from './testSqlSnippets';",
        "import { runSqlSnippetsTests } from './testSqlSnippets';\nimport { runPerformanceAnalyzerTests } from './testPerformanceAnalyzer';"
    );
    content = content.replace(
        "{ name: '0. SQL SNIPPETS', runner: runSqlSnippetsTests },",
        "{ name: '0. PERFORMANCE ANALYZER', runner: runPerformanceAnalyzerTests },\n  { name: '0. SQL SNIPPETS', runner: runSqlSnippetsTests },"
    );
    fs.writeFileSync('tests/runAllTests.ts', content);
}
