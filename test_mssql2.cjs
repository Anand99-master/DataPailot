const sql = require('mssql');

async function test() {
  const pool = await sql.connect('mssql://sa:sa@localhost/db?encrypt=true&trustServerCertificate=true');
  const result = await pool.query('SELECT 1 as id, 2 as id');
  console.log('Recordset:', JSON.stringify(result.recordset));
  console.log('Columns:', JSON.stringify(result.recordset.columns));
  pool.close();
}
test().catch(console.error);
