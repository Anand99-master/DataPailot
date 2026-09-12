const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  "import {\nimport { ChartConfig, ChartType } from './types/visualization';",
  "import { SanitizedConnectionInfo, TableDetailsResult, DiscoveredTable, DatabaseRelationship } from './types/database';\nimport { ChartConfig, ChartType } from './types/visualization';"
);
fs.writeFileSync('src/App.tsx', content);
