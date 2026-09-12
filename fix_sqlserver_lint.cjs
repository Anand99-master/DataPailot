const fs = require('fs');

let content = fs.readFileSync('server/database/SQLServerAdapter.ts', 'utf8');

// Fix 'TOP/FETCH'
content = content.replace("limitSyntax: 'TOP/FETCH'", "limitSyntax: 'FETCH'");

// Remove request.timeout = ...
content = content.replace(
  "      if (options?.timeoutMs) {\n        request.timeout = options.timeoutMs;\n      }",
  "      // if (options?.timeoutMs) {\n      //   request.timeout = options.timeoutMs;\n      // }"
);

// Fix QueryResultColumn import
content = content.replace(
  "import { DatabaseMetadata, ColumnMetadata, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo, ConnectionTestResult, DiscoveredTable, TableDetailsResult, QueryResultData, QueryExecutionOptions, DatabaseRelationship, TableColumnInfo, DatabaseConnectionParams } from './DatabaseAdapter';",
  "import { DatabaseMetadata, ColumnMetadata, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo, ConnectionTestResult, DiscoveredTable, TableDetailsResult, QueryResultData, QueryExecutionOptions, DatabaseRelationship, TableColumnInfo, DatabaseConnectionParams, QueryResultColumn } from './DatabaseAdapter';"
);

fs.writeFileSync('server/database/SQLServerAdapter.ts', content);
