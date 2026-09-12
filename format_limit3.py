with open('server/database/AnalysisSqlGenerator.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "LIMIT " in line and "`;" in line:
        # line is like: LIMIT ${limit};`;
        # we need to rewrite the backtick block
        # Actually this is hard to do line-by-line because the `const sql = ` is lines above.
        pass
