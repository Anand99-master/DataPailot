const fs = require('fs');
let content = fs.readFileSync('src/components/Lineage/LineageGraph.tsx', 'utf8');

// useNodesState and useEdgesState exist in react-flow-renderer?
// Actually, let's just use it and if it fails to compile we will switch to useState
