const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.scripts['test:adapters'] = 'tsx tests/runDatabaseAdapterTests.ts';
pkg.scripts['test:dialect'] = 'tsx tests/testPhase12Matrix.ts';
pkg.scripts['test:security'] = 'tsx tests/testSqlSecurity.ts';
pkg.scripts['test:schema'] = 'tsx tests/testSchemaAndGrounding.ts';
pkg.scripts['test:lineage'] = 'tsx tests/testDataLineage.ts';
pkg.scripts['test:analysis'] = 'tsx tests/testDashboardAndFilters.ts';
pkg.scripts['test:all'] = 'tsx tests/runAllTests.ts';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
