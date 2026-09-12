const fs = require('fs');
let content = fs.readFileSync('src/components/Lineage/exportUtils.ts', 'utf8');

const replacement = `
  // 4. Join Paths (Direct joins)
  const jpData = relationships.map(r => ({
    'From Table': \`\${r.sourceSchema}.\${r.sourceTable}\`,
    'To Table': \`\${r.targetSchema}.\${r.targetTable}\`,
    'Path': \`\${r.sourceTable} -> \${r.targetTable}\`,
    'Join Conditions': \`\${r.sourceTable}.\${r.sourceColumn} = \${r.targetTable}.\${r.targetColumn}\`
  }));
  const wsJp = XLSX.utils.json_to_sheet(jpData.length > 0 ? jpData : [{ 'From Table': '', 'To Table': '', 'Path': '', 'Join Conditions': '' }]);
`;

content = content.replace(
  "// 4. Join Paths (Empty template if no data)\n  const jpData = [{ 'From Table': '', 'To Table': '', 'Path': '', 'Join Conditions': '' }];\n  const wsJp = XLSX.utils.json_to_sheet(jpData);",
  replacement
);

fs.writeFileSync('src/components/Lineage/exportUtils.ts', content);
