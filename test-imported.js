fetch('http://localhost:3000/api/database/tables/imported/datapiot_import_test_1')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
