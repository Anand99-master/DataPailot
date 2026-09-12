import re

with open('server/database/AnalysisSqlGenerator.ts', 'r') as f:
    content = f.read()

def replace_const_sql(match):
    inner = match.group(1)
    lim = match.group(2)
    return f"const sql = this.dialect.formatLimit(`{inner}`, {lim}) + ';';"

# Handle both actual newlines and \n literals
content = re.sub(r"const sql = `([^`]*?)(?:\n|\\n)LIMIT\s+([0-9]+|\$\{[^\}]+\});`;", replace_const_sql, content)

def replace_obj_sql(match):
    prefix = match.group(1)
    inner = match.group(2)
    lim = match.group(3)
    return f"{prefix}this.dialect.formatLimit(`{inner}`, {lim}) + ';'"

content = re.sub(r"(sql:\s+)`([^`]*?)(?:\n|\\n)LIMIT\s+([0-9]+|\$\{[^\}]+\});`", replace_obj_sql, content)

with open('server/database/AnalysisSqlGenerator.ts', 'w') as f:
    f.write(content)
