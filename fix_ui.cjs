const fs = require('fs');

let content = fs.readFileSync('src/components/Sidebar/ConnectionModal.tsx', 'utf8');

// Add Oracle button
content = content.replace(
  "              <button\n                type=\"button\"\n                onClick={() => {\n                  setDbType('sqlite');",
  "              <button\n                type=\"button\"\n                onClick={() => {\n                  setDbType('oracle');\n                  setPort('1521');\n                }}\n                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center justify-center gap-1.5 ${\n                  dbType === 'oracle'\n                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'\n                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'\n                }`}\n              >\n                <span>Oracle</span>\n              </button>\n              <button\n                type=\"button\"\n                onClick={() => {\n                  setDbType('sqlite');"
);

// Update Database Name label based on type
content = content.replace(
  "<label className=\"block text-xs font-medium text-slate-300 mb-1\">Database Name</label>",
  "<label className=\"block text-xs font-medium text-slate-300 mb-1\">{dbType === 'oracle' ? 'Service Name / SID' : 'Database Name'}</label>"
);

// Update connect button disable logic to accommodate Oracle (no change strictly needed but double check)
// disable logic is: (dbType === 'sqlite' ? !filePath : (!host || !database || !username)) -> handles oracle just fine

fs.writeFileSync('src/components/Sidebar/ConnectionModal.tsx', content);
