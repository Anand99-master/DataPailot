const fs = require('fs');

// 1. Update types
let typesContent = fs.readFileSync('src/types/performance.ts', 'utf8');
if (!typesContent.includes('IndexInfo')) {
  typesContent += `\nexport interface IndexInfo {
  tableName: string;
  indexName: string;
  columns: string[];
  isUnique: boolean;
}\n`;
  
  typesContent = typesContent.replace(
    "warnings: string[];",
    "warnings: string[];\n  indexes?: IndexInfo[];"
  );
  fs.writeFileSync('src/types/performance.ts', typesContent);
}

// 2. Update Modal
let modalContent = fs.readFileSync('src/components/Editor/PerformanceAnalyzerModal.tsx', 'utf8');
modalContent = modalContent.replace(
  "const cacheKey = Object.keys(tableDetailsCache).find(k => k.endsWith(relName));",
  ""
).replace(
  "if (!cacheKey) return null;",
  ""
).replace(
  "const details = tableDetailsCache[cacheKey];",
  "const indexes = analysis.indexes?.filter(i => i.tableName === relName) || [];"
).replace(
  "if (!details || !details.indexes || details.indexes.length === 0) {",
  "if (indexes.length === 0) {"
).replace(
  "details.indexes.map(idx =>",
  "indexes.map(idx =>"
);

fs.writeFileSync('src/components/Editor/PerformanceAnalyzerModal.tsx', modalContent);

// 3. Update App.tsx to fetch indexes
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

const analyzePlanImport = "import { analyzePlan } from './utils/performanceParser';";
if (!appContent.includes("import { PlanNode } from './types/performance';")) {
  appContent = appContent.replace(analyzePlanImport, analyzePlanImport + "\nimport { PlanNode } from './types/performance';");
}

const findRelationsFunc = `
        const findRelations = (node: PlanNode, set: Set<string>) => {
          if (node['Relation Name']) set.add(node['Relation Name']);
          if (node.Plans) node.Plans.forEach(child => findRelations(child, set));
        };
`;

const fetchIndexesLogic = `
        if (Array.isArray(planArray) && planArray.length > 0 && planArray[0].Plan) {
          const analysis = analyzePlan(planArray[0].Plan, sql, tableDetailsCache);
          
          // Try to fetch indexes
          try {
            const rels = new Set<string>();
            const findRelations = (node: any, set: Set<string>) => {
              if (node['Relation Name']) set.add(node['Relation Name']);
              if (node.Plans) node.Plans.forEach((child: any) => findRelations(child, set));
            };
            findRelations(planArray[0].Plan, rels);
            
            if (rels.size > 0) {
              const tablesList = Array.from(rels).map(r => \`'\${r}'\`).join(',');
              const indexQuery = \`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN (\${tablesList})\`;
              const idxResult = await DatabaseApiClient.executeQuery(sessionId, indexQuery);
              
              if (!idxResult.error && idxResult.rows) {
                analysis.indexes = idxResult.rows.map(r => {
                  const def = r.indexdef || '';
                  const isUnique = def.toLowerCase().includes('unique index');
                  
                  // Extract columns from between parentheses
                  const colMatch = def.match(/\\((.*?)\\)/);
                  const columns = colMatch ? colMatch[1].split(',').map((c:string) => c.trim()) : [];
                  
                  return {
                    tableName: r.tablename,
                    indexName: r.indexname,
                    columns,
                    isUnique
                  };
                });
              }
            }
          } catch (e) {
            console.error('Failed to fetch indexes', e);
          }

          setCurrentPerformanceAnalysis(analysis);
          setPerformanceHistory(prev => [analysis, ...prev]);
        }
`;

appContent = appContent.replace(
  /if \(Array\.isArray\(planArray\) && planArray\.length > 0 && planArray\[0\]\.Plan\) \{[\s\S]*?\} else \{/m,
  fetchIndexesLogic + "\n        } else {"
);

fs.writeFileSync('src/App.tsx', appContent);
