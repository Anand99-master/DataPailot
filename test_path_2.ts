import { findJoinPath, generateJoinSql } from './src/components/Lineage/joinPathUtils';
import { DatabaseRelationship } from './src/types/database';

const tables: any[] = [];
const relationships: DatabaseRelationship[] = [
  {
    constraintName: 'fk_order_customer',
    sourceSchema: 'main',
    sourceTable: 'orders',
    sourceColumn: 'customer_id',
    targetSchema: 'main',
    targetTable: 'customers',
    targetColumn: 'customer_id'
  },
  {
    constraintName: 'fk_order_item_order',
    sourceSchema: 'main',
    sourceTable: 'order_items',
    sourceColumn: 'order_id',
    targetSchema: 'main',
    targetTable: 'orders',
    targetColumn: 'order_id'
  },
  {
    constraintName: 'fk_order_item_product',
    sourceSchema: 'main',
    sourceTable: 'order_items',
    sourceColumn: 'product_id',
    targetSchema: 'main',
    targetTable: 'products',
    targetColumn: 'product_id'
  }
];

const path = findJoinPath('main.customers', 'main.products', tables, relationships);
console.log(path);
if (path) {
  console.log(generateJoinSql('main.customers', 'main.products', path));
}
