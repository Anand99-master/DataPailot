const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace("}\n\n        } else {", "} else {");

fs.writeFileSync('src/App.tsx', content);
