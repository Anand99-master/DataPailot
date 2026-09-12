import { Dashboard } from '../types/dashboard';
import { QueryResult } from '../types/database';

export class DashboardExportService {
  /**
   * Exports dashboard configuration as a clean JSON file (without credentials)
   */
  public static exportDashboardJson(dashboard: Dashboard): void {
    // Sanitize to guarantee no secrets are included
    const sanitizedConfig = {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      widgets: dashboard.widgets.map(w => ({
        id: w.id,
        title: w.title,
        description: w.description,
        chartType: w.chartType,
        size: w.size,
        position: w.position,
        chartConfig: w.chartConfig,
        queryRef: {
          type: w.queryRef.type,
          sql: w.queryRef.sql,
          sourceTable: w.queryRef.sourceTable,
          referencedTables: w.queryRef.referencedTables,
          referencedColumns: w.queryRef.referencedColumns
        }
      })),
      filters: dashboard.filters,
      layout: dashboard.layout,
      autoRefreshInterval: dashboard.autoRefreshInterval,
      createdAt: dashboard.createdAt,
      updatedAt: dashboard.updatedAt
    };

    const blob = new Blob([JSON.stringify(sanitizedConfig, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const filename = `${dashboard.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_config.json`;
    this.triggerDownload(blob, filename);
  }

  /**
   * Exports all widget underlying query results as a structured CSV package
   */
  public static exportAllWidgetsCsv(dashboard: Dashboard, widgetResults: Map<string, QueryResult>): void {
    let fullContent = `# DataPilot Dashboard Export: ${dashboard.name}\n`;
    fullContent += `# Exported: ${new Date().toISOString()}\n\n`;

    for (const widget of dashboard.widgets) {
      const res = widgetResults.get(widget.id) || widget.cachedResult;
      fullContent += `\n=========================================\n`;
      fullContent += `WIDGET: ${widget.title} (${widget.chartType})\n`;
      fullContent += `QUERY: ${widget.queryRef.sql.replace(/\n/g, ' ')}\n`;
      fullContent += `=========================================\n`;

      if (!res || !res.rows || res.rows.length === 0) {
        fullContent += `(No rows returned)\n\n`;
        continue;
      }

      const colNames = res.columns.map(c => c.name);
      fullContent += colNames.join(',') + '\n';

      for (const row of res.rows) {
        const line = colNames
          .map(c => {
            const val = row[c];
            if (val === null || val === undefined) return '';
            return JSON.stringify(val);
          })
          .join(',');
        fullContent += line + '\n';
      }
      fullContent += '\n';
    }

    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8' });
    const filename = `${dashboard.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data_export.csv`;
    this.triggerDownload(blob, filename);
  }

  /**
   * Triggers native browser print dialog formatted for PDF export
   */
  public static printDashboardAsPdf(): void {
    window.print();
  }

  private static triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
