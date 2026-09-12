const fs = require('fs');
let content = fs.readFileSync('src/utils/sqlAutocomplete.ts', 'utf8');

content = content.replace(
  'const aliases = extractAliases(textBefore);',
  'const aliases = extractAliases(sql);'
);

fs.writeFileSync('src/utils/sqlAutocomplete.ts', content);
