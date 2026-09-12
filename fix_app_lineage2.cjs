const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const lineagePanel = `
            ) : activeWorkspaceView === 'lineage' ? (
              <DataLineageWorkspace
                tables={tables}
                relationships={relationships}
                tableDetailsCache={tableDetailsCache}
                onSelectTable={handleSelectTable}
                onLoadTableDetails={async (schema, name) => {
                  try {
                    const details = await DatabaseApiClient.getTableDetails(schema, name);
                    setTableDetailsCache(prev => ({ ...prev, [\`\${schema}.\${name}\`]: details }));
                  } catch (e) {}
                }}
              />
            ) : (`;

content = content.replace(
  ") : (\\n              <DashboardWorkspace",
  lineagePanel + "\\n              <DashboardWorkspace"
);

// Fallback if the string with \n fails:
if (content.indexOf(lineagePanel) === -1) {
  content = content.replace(
    ") : (\n              <DashboardWorkspace",
    lineagePanel + "\n              <DashboardWorkspace"
  );
}

fs.writeFileSync('src/App.tsx', content);
