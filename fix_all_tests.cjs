const fs = require('fs');
let content = fs.readFileSync('tests/runAllTests.ts', 'utf8');

content = content.replace(
  "runner: () => { name: string; passed: boolean; error?: string }[];",
  "runner: () => any;"
);

content = content.replace(
  "const results = suite.runner();",
  "const results = await suite.runner();"
);

// Wrap in async IIFE
if (!content.includes('async function runAll()')) {
  content = content.replace(
    "let totalTests = 0;",
    "async function runAll() {\nlet totalTests = 0;"
  );
  content = content.replace(
    "  process.exit(0);\n}",
    "  process.exit(0);\n}\n}\nrunAll().catch(console.error);"
  );
}

fs.writeFileSync('tests/runAllTests.ts', content);
