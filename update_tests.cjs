const fs = require('fs');

const testCode = `
import { detectOrphans } from '../src/components/Lineage/orphanDetector';
import { findJoinPath, generateJoinSql, normalizeTableId } from '../src/components/Lineage/joinPathUtils';
import { QuerySafetyValidator } from '../server/database/QuerySafetyValidator';
import { DiscoveredTable, DatabaseRelationship } from '../src/types/database';

export function runDataLineageTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: errorMsg });
      console.error(\`FAILED: \${name} - \${errorMsg}\`);
    }
  };

  const tables: DiscoveredTable[] = [
    { schema: 'public', name: 'customers', type: 'BASE TABLE', approximateRowCount: 0 },
    { schema: 'public', name: 'orders', type: 'BASE TABLE', approximateRowCount: 0 },
    { schema: 'public', name: 'order_items', type: 'BASE TABLE', approximateRowCount: 0 },
    { schema: 'public', name: 'products', type: 'BASE TABLE', approximateRowCount: 0 },
    { schema: 'public', name: 'events', type: 'BASE TABLE', approximateRowCount: 0 },
    { schema: 'public', name: 'test_new_table', type: 'BASE TABLE', approximateRowCount: 0 },
    { schema: 'public', name: 'cycle_a', type: 'BASE TABLE', approximateRowCount: 0 },
    { schema: 'public', name: 'cycle_b', type: 'BASE TABLE', approximateRowCount: 0 }
  ];

  const rels: DatabaseRelationship[] = [
    // customers -> orders (orders has FK to customers)
    { sourceSchema: 'public', sourceTable: 'orders', sourceColumn: 'customer_id', targetSchema: 'public', targetTable: 'customers', targetColumn: 'id', constraintName: 'fk_orders_cust' },
    // orders -> order_items (order_items has FK to orders)
    { sourceSchema: 'public', sourceTable: 'order_items', sourceColumn: 'order_id', targetSchema: 'public', targetTable: 'orders', targetColumn: 'id', constraintName: 'fk_items_order' },
    // order_items -> products (order_items has FK to products)
    { sourceSchema: 'public', sourceTable: 'order_items', sourceColumn: 'product_id', targetSchema: 'public', targetTable: 'products', targetColumn: 'id', constraintName: 'fk_items_prod' },
    // duplicate relationship for multiple FKs
    { sourceSchema: 'public', sourceTable: 'orders', sourceColumn: 'billing_customer_id', targetSchema: 'public', targetTable: 'customers', targetColumn: 'id', constraintName: 'fk_orders_billing' },
    // cycle relationship
    { sourceSchema: 'public', sourceTable: 'cycle_a', sourceColumn: 'b_id', targetSchema: 'public', targetTable: 'cycle_b', targetColumn: 'id', constraintName: 'fk_cycle_a' },
    { sourceSchema: 'public', sourceTable: 'cycle_b', sourceColumn: 'a_id', targetSchema: 'public', targetTable: 'cycle_a', targetColumn: 'id', constraintName: 'fk_cycle_b' }
  ];

  // 1. Direct FK path
  const directPath = findJoinPath('public.orders', 'public.customers', tables, rels);
  assertTest('Direct FK path', directPath !== null && directPath.length === 1, 'Failed to find direct path');

  // 2. Two-hop path
  const twoHop = findJoinPath('public.customers', 'public.order_items', tables, rels);
  assertTest('Two-hop path', twoHop !== null && twoHop.length === 2, 'Failed to find two-hop path');

  // 3. Three-hop path (customers -> products)
  const threeHop = findJoinPath('public.customers', 'public.products', tables, rels);
  assertTest('Three-hop path (customers -> products)', threeHop !== null && threeHop.length === 3, 'Failed to find three-hop path');

  // 4. Reverse FK traversal (products -> customers)
  const reversePath = findJoinPath('public.products', 'public.customers', tables, rels);
  assertTest('Reverse FK traversal (products -> customers)', reversePath !== null && reversePath.length === 3, 'Failed reverse path');

  // 5. customers -> products (unqualified name test)
  const unqPath = findJoinPath('customers', 'products', tables, rels);
  assertTest('customers -> products (unqualified)', unqPath !== null && unqPath.length === 3, 'Failed with unqualified names');

  // 6. products -> customers (unqualified)
  const unqRevPath = findJoinPath('products', 'customers', tables, rels);
  assertTest('products -> customers (unqualified)', unqRevPath !== null && unqRevPath.length === 3, 'Failed reverse with unqualified names');

  // 7. customers -> orders
  const custOrders = findJoinPath('customers', 'orders', tables, rels);
  assertTest('customers -> orders', custOrders !== null && custOrders.length === 1, 'Failed customers to orders');

  // 8. orders -> products
  const ordProd = findJoinPath('orders', 'products', tables, rels);
  assertTest('orders -> products', ordProd !== null && ordProd.length === 2, 'Failed orders to products');

  // 9. disconnected tables (events -> products)
  const disconnected = findJoinPath('events', 'products', tables, rels);
  assertTest('disconnected tables', disconnected === null, 'Should return null for disconnected tables');

  // 10. cyclic relationships
  const cyclic = findJoinPath('cycle_a', 'cycle_b', tables, rels);
  assertTest('cyclic relationships', cyclic !== null && cyclic.length === 1, 'Failed to handle cycle');

  // 11. multiple FK relationships (orders -> customers)
  // Should pick one of the paths, length is 1
  const multiple = findJoinPath('orders', 'customers', tables, rels);
  assertTest('multiple FK relationships', multiple !== null && multiple.length === 1, 'Failed on multiple FKs');

  // 12. schema-qualified tables ("public"."customers")
  const quoted = findJoinPath('"public"."customers"', '"public"."products"', tables, rels);
  assertTest('schema-qualified tables', quoted !== null && quoted.length === 3, 'Failed on quoted names');

  // 13. duplicate relationships
  // Tested naturally via the billing_customer_id duplicate

  // 14. path generation
  assertTest('path generation', threeHop !== null && threeHop[0].sourceTable === 'customers' && threeHop[0].targetTable === 'orders', 'Path generation step 1 failed');
  
  // 15. JOIN SQL generation
  if (threeHop) {
    const sql = generateJoinSql('public.customers', 'public.products', threeHop);
    assertTest('JOIN SQL generation', sql.includes('JOIN "public"."orders" AS t1') && sql.includes('JOIN "public"."order_items" AS t2') && sql.includes('JOIN "public"."products" AS t3'), 'SQL missing joins');
    assertTest('JOIN SQL generation schema', sql.includes('FROM "public"."customers" AS t0'), 'SQL missing FROM base');
  } else {
    assertTest('JOIN SQL generation', false, 'threeHop was null');
  }

  return results;
}
`;

fs.writeFileSync('tests/testDataLineage.ts', testCode);
console.log("Updated tests/testDataLineage.ts");
