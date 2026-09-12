import { findJoinPath, generateJoinSql } from './src/components/Lineage/joinPathUtils';
import { DatabaseRelationship } from './src/types/database';

const tables: any[] = [];
const relationships: DatabaseRelationship[] = [
  {
    constraintName: 'fk_order_customer',
    sourceSchema: 'public',
    sourceTable: 'orders',
    sourceColumn: 'customer_id',
    targetSchema: 'public',
    targetTable: 'customers',
    targetColumn: 'customer_id'
  },
  {
    constraintName: 'fk_order_item_order',
    sourceSchema: 'public',
    sourceTable: 'order_items',
    sourceColumn: 'order_id',
    targetSchema: 'public',
    targetTable: 'orders',
    targetColumn: 'order_id'
  },
  {
    constraintName: 'fk_order_item_product',
    sourceSchema: 'public',
    sourceTable: 'order_items',
    sourceColumn: 'product_id',
    targetSchema: 'public',
    targetTable: 'products',
    targetColumn: 'product_id'
  }
];

console.log(findJoinPath('public.customers', 'public.products', tables, relationships));
