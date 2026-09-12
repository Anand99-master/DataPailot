import { findJoinPath } from './src/components/Lineage/joinPathUtils';
import { DatabaseRelationship } from './src/types/database';

const relationships: DatabaseRelationship[] = [
  {
    constraintName: 'fk_orders_customers',
    sourceSchema: 'public',
    sourceTable: 'orders',
    sourceColumn: 'customer_id',
    targetSchema: 'public',
    targetTable: 'customers',
    targetColumn: 'customer_id'
  },
  {
    constraintName: 'fk_order_items_orders',
    sourceSchema: 'public',
    sourceTable: 'order_items',
    sourceColumn: 'order_id',
    targetSchema: 'public',
    targetTable: 'orders',
    targetColumn: 'order_id'
  },
  {
    constraintName: 'fk_order_items_products',
    sourceSchema: 'public',
    sourceTable: 'order_items',
    sourceColumn: 'product_id',
    targetSchema: 'public',
    targetTable: 'products',
    targetColumn: 'product_id'
  }
];

const path = findJoinPath('public.customers', 'public.products', [], relationships);
console.log("Path:", path);
