import { DiscoveredTable, DatabaseRelationship } from '../../types/database';

export function detectOrphans(tables: DiscoveredTable[], relationships: DatabaseRelationship[]) {
  const tableNames = new Set(tables.map(t => `${t.schema}.${t.name}`));
  const connectedTables = new Set<string>();
  const brokenRelationships: string[] = [];

  relationships.forEach(r => {
    const source = `${r.sourceSchema}.${r.sourceTable}`;
    const target = `${r.targetSchema}.${r.targetTable}`;
    
    connectedTables.add(source);
    connectedTables.add(target);

    if (!tableNames.has(target)) {
      brokenRelationships.push(`${source}.${r.sourceColumn} references missing table ${target}`);
    }
  });

  const disconnectedTables = tables
    .filter(t => !connectedTables.has(`${t.schema}.${t.name}`))
    .map(t => `${t.schema}.${t.name}`);

  return {
    disconnectedTables,
    brokenRelationships
  };
}
