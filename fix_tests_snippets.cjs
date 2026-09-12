const fs = require('fs');
let content = fs.readFileSync('tests/runAllTests.ts', 'utf8');

if (!content.includes('runSqlSnippetsTests')) {
    content = content.replace(
        "import { runQueryLibraryTests } from './testQueryLibrary';",
        "import { runQueryLibraryTests } from './testQueryLibrary';\nimport { runSqlSnippetsTests } from './testSqlSnippets';"
    );
    content = content.replace(
        "{ name: '0. QUERY LIBRARY', runner: runQueryLibraryTests },",
        "{ name: '0. SQL SNIPPETS', runner: runSqlSnippetsTests },\n  { name: '0. QUERY LIBRARY', runner: runQueryLibraryTests },"
    );
    fs.writeFileSync('tests/runAllTests.ts', content);
}
