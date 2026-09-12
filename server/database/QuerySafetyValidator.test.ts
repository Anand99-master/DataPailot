import { QuerySafetyValidator } from './QuerySafetyValidator';

/**
 * Test suite for QuerySafetyValidator
 */
function runTests() {
  const tests: { name: string; sql: string; expectedValid: boolean; description?: string }[] = [
    // --- Allowed Read-Only Queries ---
    {
      name: 'Simple SELECT',
      sql: 'SELECT * FROM users',
      expectedValid: true
    },
    {
      name: 'SELECT with semicolon at end',
      sql: 'SELECT id, username, email FROM "users" WHERE is_active = true;',
      expectedValid: true
    },
    {
      name: 'SELECT with multiple trailing semicolons and whitespace',
      sql: 'SELECT count(*) FROM orders;;  ',
      expectedValid: true
    },
    {
      name: 'CTE query with WITH',
      sql: 'WITH active_orders AS (SELECT * FROM orders WHERE status = \'completed\') SELECT * FROM active_orders;',
      expectedValid: true
    },
    {
      name: 'SELECT with quoted identifier matching forbidden keyword',
      sql: 'SELECT "drop", "delete", "create" FROM "tables_catalog";',
      expectedValid: true
    },
    {
      name: 'SELECT with joins, subqueries, and aggregates',
      sql: `
        SELECT u.id, u.name, count(o.id) as order_count, sum(o.total_amount) as total_spent
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        WHERE u.created_at >= '2025-01-01'
        GROUP BY u.id, u.name
        HAVING count(o.id) > 5
        ORDER BY total_spent DESC
        LIMIT 100;
      `,
      expectedValid: true
    },
    {
      name: 'SELECT with explain (read-only analytical)',
      sql: 'EXPLAIN SELECT * FROM customer_transactions WHERE amount > 1000;',
      expectedValid: true
    },

    // --- Blocked Mutating & Destructive Queries ---
    {
      name: 'Block INSERT',
      sql: 'INSERT INTO users (name, email) VALUES (\'Alice\', \'alice@example.com\');',
      expectedValid: false
    },
    {
      name: 'Block UPDATE',
      sql: 'UPDATE users SET is_admin = true WHERE id = 1;',
      expectedValid: false
    },
    {
      name: 'Block DELETE',
      sql: 'DELETE FROM users WHERE id = 1;',
      expectedValid: false
    },
    {
      name: 'Block DROP TABLE',
      sql: 'DROP TABLE users;',
      expectedValid: false
    },
    {
      name: 'Block TRUNCATE',
      sql: 'TRUNCATE TABLE audit_logs;',
      expectedValid: false
    },
    {
      name: 'Block ALTER TABLE',
      sql: 'ALTER TABLE users ADD COLUMN is_banned boolean;',
      expectedValid: false
    },
    {
      name: 'Block CREATE TABLE',
      sql: 'CREATE TABLE backdoor (id serial, cmd text);',
      expectedValid: false
    },
    {
      name: 'Block GRANT',
      sql: 'GRANT ALL PRIVILEGES ON DATABASE mydb TO hacker;',
      expectedValid: false
    },
    {
      name: 'Block REVOKE',
      sql: 'REVOKE ALL ON users FROM public;',
      expectedValid: false
    },

    // --- Multi-Statement Attacks ---
    {
      name: 'Block Multi-Statement: SELECT then DROP',
      sql: 'SELECT 1; DROP TABLE users;',
      expectedValid: false
    },
    {
      name: 'Block Multi-Statement: SELECT then DELETE',
      sql: 'SELECT * FROM users; DELETE FROM users;',
      expectedValid: false
    },
    {
      name: 'Block Multi-Statement with comment separator',
      sql: 'SELECT 1; /* comment */ DROP TABLE users;',
      expectedValid: false
    },

    // --- Destructive CTEs ---
    {
      name: 'Block CTE with DELETE RETURNING',
      sql: 'WITH deleted_rows AS (DELETE FROM users RETURNING *) SELECT * FROM deleted_rows;',
      expectedValid: false
    },
    {
      name: 'Block CTE with INSERT RETURNING',
      sql: 'WITH new_user AS (INSERT INTO users (name) VALUES (\'Bob\') RETURNING *) SELECT * FROM new_user;',
      expectedValid: false
    },
    {
      name: 'Block CTE with UPDATE RETURNING',
      sql: 'WITH updated AS (UPDATE accounts SET balance = balance + 1000 RETURNING *) SELECT * FROM updated;',
      expectedValid: false
    },

    // --- Stored Procedures and Execution ---
    {
      name: 'Block EXEC',
      sql: 'EXEC sp_msforeachtable;',
      expectedValid: false
    },
    {
      name: 'Block CALL',
      sql: 'CALL purge_old_records();',
      expectedValid: false
    },
    {
      name: 'Block DO block',
      sql: 'DO $$ BEGIN RAISE NOTICE \'hello\'; END $$;',
      expectedValid: false
    },

    // --- Dangerous Administrative Functions ---
    {
      name: 'Block pg_sleep denial of service',
      sql: 'SELECT pg_sleep(100);',
      expectedValid: false
    },
    {
      name: 'Block pg_terminate_backend',
      sql: 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity;',
      expectedValid: false
    },
    {
      name: 'Block pg_read_file file exfiltration',
      sql: 'SELECT pg_read_file(\'/etc/passwd\', 0, 1000);',
      expectedValid: false
    },
    {
      name: 'Block dblink cross-database command',
      sql: 'SELECT * FROM dblink(\'host=evil.com\', \'SELECT 1\') AS t(id int);',
      expectedValid: false
    },

    // --- Empty and Malformed ---
    {
      name: 'Block Empty query',
      sql: '',
      expectedValid: false
    },
    {
      name: 'Block Whitespace-only query',
      sql: '   \n\t  ',
      expectedValid: false
    }
  ];

  let passed = 0;
  let failed = 0;

  console.log('--- Running QuerySafetyValidator Test Suite ---');

  for (const test of tests) {
    const res = QuerySafetyValidator.validate(test.sql);
    const isSuccess = res.isValid === test.expectedValid;

    if (isSuccess) {
      passed++;
      console.log(`✓ PASS: ${test.name}`);
    } else {
      failed++;
      console.error(`✗ FAIL: ${test.name}`);
      console.error(`   SQL: "${test.sql.replace(/\n/g, ' ')}"`);
      console.error(`   Expected valid: ${test.expectedValid}, but got: ${res.isValid}`);
      if (res.error) {
        console.error(`   Error returned: "${res.error}"`);
      }
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, total ${tests.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
