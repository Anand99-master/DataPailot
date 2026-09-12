
import { DiscoveredTable, DatabaseRelationship } from '../../types/database';

export interface JoinStep {
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
}

export function normalizeTableId(id: string, defaultSchema?: string): string {
  if (!id) return '';
  const unquoted = id.replace(/["`\[\]]/g, '');
  if (unquoted.includes('.')) {
    return unquoted;
  }
  return defaultSchema ? `${defaultSchema}.${unquoted}` : unquoted;
}

export function findJoinPath(
  fromId: string, 
  toId: string, 
  tables: DiscoveredTable[], 
  relationships: DatabaseRelationship[]
): JoinStep[] | null {
  // Find default schema from tables (e.g., 'public', 'main', 'dbo')
  const defaultSchema = tables.length > 0 ? tables[0].schema : 'public';
  
  const normFromId = normalizeTableId(fromId, defaultSchema);
  const normToId = normalizeTableId(toId, defaultSchema);
  
  if (!normFromId || !normToId) return null;
  if (normFromId === normToId) return [];

  // BFS to find shortest path
  const graph = new Map<string, JoinStep[]>();
  
  relationships.forEach(r => {
    const s = normalizeTableId(`${r.sourceSchema || defaultSchema}.${r.sourceTable}`);
    const t = normalizeTableId(`${r.targetSchema || defaultSchema}.${r.targetTable}`);
    
    if (!graph.has(s)) graph.set(s, []);
    if (!graph.has(t)) graph.set(t, []);
    
    graph.get(s)!.push({
      sourceSchema: r.sourceSchema || defaultSchema || '',
      sourceTable: r.sourceTable,
      sourceColumn: r.sourceColumn,
      targetSchema: r.targetSchema || defaultSchema || '',
      targetTable: r.targetTable,
      targetColumn: r.targetColumn
    });
    
    // Reverse direction for join capability
    graph.get(t)!.push({
      sourceSchema: r.targetSchema || defaultSchema || '',
      sourceTable: r.targetTable,
      sourceColumn: r.targetColumn,
      targetSchema: r.sourceSchema || defaultSchema || '',
      targetTable: r.sourceTable,
      targetColumn: r.sourceColumn
    });
  });

  const queue: { currentId: string, path: JoinStep[] }[] = [{ currentId: normFromId, path: [] }];
  const visited = new Set<string>();
  visited.add(normFromId);

  while (queue.length > 0) {
    const { currentId, path } = queue.shift()!;
    
    if (currentId === normToId) {
      return path;
    }

    const neighbors = graph.get(currentId) || [];
    for (const edge of neighbors) {
      const nextId = normalizeTableId(`${edge.targetSchema}.${edge.targetTable}`);
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push({
          currentId: nextId,
          path: [...path, edge]
        });
      }
    }
  }

  return null;
}

export function generateJoinSql(fromId: string, toId: string, path: JoinStep[]): string {
  if (!path || path.length === 0) return '';
  
  // Safely determine base schema and table from the first step in the resolved path
  const firstStep = path[0];
  const actualSourceSchema = firstStep.sourceSchema;
  const actualSourceTable = firstStep.sourceTable;
  
  const schemaPrefix = actualSourceSchema ? `"${actualSourceSchema}".` : '';
  let sql = `SELECT *\nFROM ${schemaPrefix}"${actualSourceTable}" AS t0`;
  
  path.forEach((step, idx) => {
    const targetSchemaPrefix = step.targetSchema ? `"${step.targetSchema}".` : '';
    const tNextAlias = `t${idx + 1}`;
    const tPrevAlias = `t${idx}`; 
    
    sql += `\nJOIN ${targetSchemaPrefix}"${step.targetTable}" AS ${tNextAlias}`;
    sql += `\n  ON ${tPrevAlias}."${step.sourceColumn}" = ${tNextAlias}."${step.targetColumn}"`;
  });
  
  sql += ';';
  return sql;
}
