const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar/ConnectionModal.tsx', 'utf8');

content = content.replace(
  "<span>MySQL (Adapter)</span>",
  "<span>MySQL</span>"
);

content = content.replace(
  "opacity-80 ${",
  "${"
).replace(
  "bg-slate-800/60 border-slate-800 text-slate-500 hover:text-slate-400",
  "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
);
content = content.replace(
  "opacity-80 ${",
  "${"
).replace(
  "bg-slate-800/60 border-slate-800 text-slate-500 hover:text-slate-400",
  "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
);

content = content.replace(
  "const params: DatabaseConnectionParams = {\n      type: dbType,\n      host: host.trim(),\n      port: Number(port) || 5432,\n      database: database.trim(),\n      username: username.trim(),\n      password: password,\n      ssl\n    };",
  "const params: DatabaseConnectionParams = {\n      type: dbType,\n      host: host.trim(),\n      port: Number(port) || (dbType === 'mysql' ? 3306 : dbType === 'sqlserver' ? 1433 : dbType === 'oracle' ? 1521 : 5432),\n      database: database.trim(),\n      username: username.trim(),\n      filePath: filePath.trim(),\n      password: password,\n      ssl\n    };"
);

fs.writeFileSync('src/components/Sidebar/ConnectionModal.tsx', content);
