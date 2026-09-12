import subprocess
print("SQL Server Join Output:")
print("-----------------------")
with open("tests/testSqlServerPagination.ts", "r") as f:
    c = f.read()

c = c.replace("assert(", "console.log(sqlServerJoin); assert(")
with open("tests/debug_sql.ts", "w") as f:
    f.write(c)
