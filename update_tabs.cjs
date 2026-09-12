const fs = require('fs');
let content = fs.readFileSync('src/components/Editor/SqlEditorTabs.tsx', 'utf8');

content = content.replace(
  "{tab.name}\n                  {tab.isRunning",
  "{tab.name}{tab.isModified ? ' *' : ''}\n                  {tab.isRunning"
);

fs.writeFileSync('src/components/Editor/SqlEditorTabs.tsx', content);
