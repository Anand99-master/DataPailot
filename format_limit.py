import re

with open('server/database/AnalysisSqlGenerator.ts', 'r') as f:
    content = f.read()

def replace_limit(match):
    before_sql = match.group(1)
    limit_val = match.group(2)
    return f"const sql = this.dialect.formatLimit(`{before_sql}`, {limit_val}) + ';';"

content = re.sub(r"const sql = `([^`]*?)\nLIMIT\s+([^`]+?);`;", replace_limit, content)
content = re.sub(r"(sql:\s+)`([^`]*?)\nLIMIT\s+([^`]+?);`", r"\1this.dialect.formatLimit(`\2`, \3) + ';'", content)

with open('server/database/AnalysisSqlGenerator.ts', 'w') as f:
    f.write(content)
