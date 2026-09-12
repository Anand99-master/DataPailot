const fs = require('fs');
let content = fs.readFileSync('src/components/Editor/SqlEditor.tsx', 'utf8');

content = content.replace(
  "Bot\n} from 'lucide-react';",
  "Bot,\n  Save,\n  Copy\n} from 'lucide-react';"
);

fs.writeFileSync('src/components/Editor/SqlEditor.tsx', content);
