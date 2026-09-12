import * as XLSX from 'xlsx';
import { DiscoveredTable, TableDetailsResult, DatabaseRelationship } from '../../types/database';

export function exportLineageToJson(tables: DiscoveredTable[], relationships: DatabaseRelationship[], tableDetailsCache: Record<string, TableDetailsResult>) {
  const data = { tables, relationships, tableDetails: tableDetailsCache };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, 'data-lineage.json');
}

export function exportLineageToCsv(tables: DiscoveredTable[], relationships: DatabaseRelationship[]) {
  // Simple relationship export for CSV
  let csv = 'Source Schema,Source Table,Source Column,Target Schema,Target Table,Target Column\n';
  relationships.forEach(r => {
    csv += `${r.sourceSchema},${r.sourceTable},${r.sourceColumn},${r.targetSchema},${r.targetTable},${r.targetColumn}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  triggerDownload(blob, 'data-lineage.csv');
}

export function exportLineageToExcel(tables: DiscoveredTable[], relationships: DatabaseRelationship[], tableDetailsCache: Record<string, TableDetailsResult>) {
  const wb = XLSX.utils.book_new();

  // 1. Table Lineage
  const tableData = tables.map(t => {
    const id = `${t.schema}.${t.name}`;
    const details = tableDetailsCache[id];
    
    return {
      'Table Name': t.name,
      'Schema': t.schema,
      'Table Type': t.type,
      'Row Count / Estimate': t.approximateRowCount || 0,
      'Primary Keys': details ? details.columns.filter(c => c.isPrimaryKey).map(c => c.name).join(', ') : '',
      'Foreign Keys': details ? details.columns.filter(c => c.isForeignKey).map(c => c.name).join(', ') : '',
      'Referenced Tables': relationships.filter(r => r.sourceTable === t.name && r.sourceSchema === t.schema).map(r => r.targetTable).join(', '),
      'Referencing Tables': relationships.filter(r => r.targetTable === t.name && r.targetSchema === t.schema).map(r => r.sourceTable).join(', ')
    };
  });
  const wsTable = XLSX.utils.json_to_sheet(tableData.length > 0 ? tableData : [{ 'Table Name': '' }]);
  XLSX.utils.book_append_sheet(wb, wsTable, "Table Lineage");

  // 2. Column Lineage
  const colData: any[] = [];
  Object.values(tableDetailsCache).forEach(details => {
    details.columns.forEach(c => {
      colData.push({
        'Table Name': details.name,
        'Column Name': c.name,
        'Data Type': c.dataType,
        'Nullable': c.isNullable ? 'Yes' : 'No',
        'Primary Key': c.isPrimaryKey ? 'Yes' : 'No',
        'Foreign Key': c.isForeignKey ? 'Yes' : 'No',
        'References': c.foreignKeyTarget ? `${c.foreignKeyTarget.table}.${c.foreignKeyTarget.column}` : '',
        'Referenced By': relationships.filter(r => r.targetTable === details.name && r.targetColumn === c.name).map(r => `${r.sourceTable}.${r.sourceColumn}`).join(', ')
      });
    });
  });
  const wsCol = XLSX.utils.json_to_sheet(colData.length > 0 ? colData : [{ 'Table Name': '' }]);
  XLSX.utils.book_append_sheet(wb, wsCol, "Column Lineage");

  // 3. Relationships
  const relData = relationships.map(r => ({
    'Source Schema': r.sourceSchema,
    'Source Table': r.sourceTable,
    'Source Column': r.sourceColumn,
    'Target Schema': r.targetSchema,
    'Target Table': r.targetTable,
    'Target Column': r.targetColumn,
    'Relationship Type': 'Foreign Key',
    'Relationship Direction': 'One-to-Many' // approximation
  }));
  const wsRel = XLSX.utils.json_to_sheet(relData.length > 0 ? relData : [{ 'Source Table': '' }]);
  XLSX.utils.book_append_sheet(wb, wsRel, "Relationships");

  
  // 4. Join Paths (Direct joins)
  const jpData = relationships.map(r => ({
    'From Table': `${r.sourceSchema}.${r.sourceTable}`,
    'To Table': `${r.targetSchema}.${r.targetTable}`,
    'Path': `${r.sourceTable} -> ${r.targetTable}`,
    'Join Conditions': `${r.sourceTable}.${r.sourceColumn} = ${r.targetTable}.${r.targetColumn}`
  }));
  const wsJp = XLSX.utils.json_to_sheet(jpData.length > 0 ? jpData : [{ 'From Table': '', 'To Table': '', 'Path': '', 'Join Conditions': '' }]);

  XLSX.utils.book_append_sheet(wb, wsJp, "Join Paths");

  XLSX.writeFile(wb, 'data-lineage.xlsx');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
