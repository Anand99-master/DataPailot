import { PlanNode, PerformanceAnalysis } from '../types/performance';
import { DiscoveredTable, TableDetailsResult } from '../types/database';

export function analyzePlan(
  plan: PlanNode,
  query: string,
  tableDetailsCache?: Record<string, TableDetailsResult>
): PerformanceAnalysis {
  let primaryScan = 'Unknown';
  let indexUsed = false;
  let joins = 0;
  let sort = false;
  const warnings: string[] = [];

  // Recursive function to analyze nodes
  const traverse = (node: PlanNode) => {
    const type = node['Node Type'];

    if (type.includes('Scan')) {
      if (primaryScan === 'Unknown' || type === 'Seq Scan') {
        primaryScan = type; // prefer to highlight seq scan if present
      }
      if (type.includes('Index')) {
        indexUsed = true;
      }
      if (type === 'Seq Scan') {
        if ((node['Plan Rows'] || 0) > 1000) {
          warnings.push(`Sequential scan on potentially large table (${node['Relation Name'] || 'unknown'}). An index may improve this query.`);
        }
      }
    }

    if (type.includes('Join') || type.includes('Nested Loop') || type.includes('Hash Join') || type.includes('Merge Join')) {
      joins++;
      if (type === 'Nested Loop' && (node['Plan Rows'] || 0) > 10000) {
        warnings.push('Nested loop on potentially large datasets. Consider checking join conditions or indexes.');
      }
    }

    if (type === 'Sort') {
      sort = true;
      if ((node['Total Cost'] || 0) > 1000) {
        warnings.push('Expensive sort operation. Consider indexing the ORDER BY columns.');
      }
    }
    
    if ((node['Plan Rows'] || 0) > 100000) {
      if (!warnings.includes('High estimated row count.')) {
        warnings.push('High estimated row count. Consider adding LIMIT or stronger WHERE filters.');
      }
    }

    if (node.Plans) {
      node.Plans.forEach(traverse);
    }
  };

  traverse(plan);
  
  if ((plan['Total Cost'] || 0) > 10000) {
    warnings.push('Very high estimated cost. This query might be slow.');
  }
  
  if (query.trim().toLowerCase().includes('select *') && primaryScan === 'Seq Scan' && (plan['Plan Rows'] || 0) > 1000) {
    warnings.push('SELECT * usage on a large table scan. Selecting only necessary columns may improve performance.');
  }

  return {
    id: `pa-${Date.now()}`,
    query,
    timestamp: new Date().toISOString(),
    plan,
    summary: {
      totalCost: plan['Total Cost'] || 0,
      startupCost: plan['Startup Cost'] || 0,
      rows: plan['Plan Rows'] || 0,
      primaryScan,
      indexUsed,
      joins,
      sort
    },
    warnings
  };
}
