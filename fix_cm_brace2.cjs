const fs = require('fs');
let content = fs.readFileSync('server/database/ConnectionManager.ts', 'utf8');

const lines = content.split('\n');
const fixedLines = [];
let skipNextBrace = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('return DatabaseAdapterFactory.create(params);')) {
    fixedLines.push(lines[i]);
    fixedLines.push(lines[i+1]); // pushes `  }`
    i++;
    // The next line is `  }` which is the extra one. Let's skip it.
    if (lines[i+1].trim() === '}') {
      i++;
    }
  } else {
    fixedLines.push(lines[i]);
  }
}

fs.writeFileSync('server/database/ConnectionManager.ts', fixedLines.join('\n'));
