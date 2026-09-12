import re

with open('server/database/AnalysisSqlGenerator.ts', 'r') as f:
    content = f.read()

# Add SqlDialect import
if "import { SqlDialect } from './SqlDialect';" not in content:
    content = "import { SqlDialect } from './SqlDialect';\n" + content
    
# Remove static from public static generate...
content = content.replace("public static generate", "public generate")

# Update quoteIdentifier and quoteTable
content = re.sub(
    r"public static quoteIdentifier\(id: string\): string \{\s+const clean = id\.replace\(/\"/g, '\"\"'\)\.trim\(\);\s+return `\"\$clean\"`;\s+\}",
    "public quoteIdentifier(id: string): string { return this.dialect.quoteIdentifier(id); }",
    content
)

content = re.sub(
    r"public static quoteTable\(schema: string \| undefined, table: string\): string \{\s+return schema \? `\"\$\{schema\}\"\.\"\$\{table\}\"` : `\"\$\{table\}\"`;\s+\}",
    "public quoteTable(schema: string | undefined, table: string): string { return this.dialect.qualifyTable(schema, table); }",
    content
)

# Convert all `this.` calls inside static methods to instance calls (since we removed static)
content = content.replace("public static quoteIdentifier", "public quoteIdentifier")
content = content.replace("public static quoteTable", "public quoteTable")

# Replace class definition to include constructor
content = content.replace("export class AnalysisSqlGenerator {", "export class AnalysisSqlGenerator {\n  constructor(private dialect: SqlDialect) {}")

# Now, fixing LIMIT x; -> this.dialect.formatLimit(..., x);
# Currently many strings are like:
# const sql = `SELECT ...
# FROM ${fullTable}
# LIMIT ${limit};`;
# We will use regex to find: `(...)\nLIMIT \$\{?(.*?)\}?;`;
# and replace it with: this.dialect.formatLimit(`\1`, \2) + ';';
# However, sometimes it's LIMIT 50;
# Sometimes it's LIMIT ${limit};
# Let's see how many occurrences of LIMIT there are.
with open('server/database/AnalysisSqlGenerator.ts', 'w') as f:
    f.write(content)
