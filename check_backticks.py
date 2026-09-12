with open('server/database/AnalysisSqlGenerator.ts', 'r') as f:
    c = f.read()

count = 0
for i, char in enumerate(c):
    if char == '`':
        # Check if it's escaped
        if i == 0 or c[i-1] != '\\':
            count += 1
            if count % 2 != 0:
                pass

print(f"Total unescaped backticks: {count}")
