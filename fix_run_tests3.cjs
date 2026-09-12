const fs = require('fs');
let content = fs.readFileSync('tests/runAllTests.ts', 'utf8');
content = content.replace("as any", "");
fs.writeFileSync('tests/runAllTests.ts', content);
