import { ChartConfig, SavedVisualization } from '../types/visualization';
import { QueryResult } from '../types/database';

export class VisualizationExportService {
  /**
   * Sanitizes cell string value against spreadsheet formula injection (CSV injection)
   * Characters =, +, -, @, \t, \r can trigger formula execution or macro attacks in spreadsheets
   */
  public static sanitizeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '""';
    let strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // If string starts with formula trigger characters, prefix with single-quote
    if (/^[=+\-@\t\r]/.test(strVal)) {
      strVal = `'${strVal}`;
    }

    return `"${strVal.replace(/"/g, '""')}"`;
  }

  /**
   * Exports data rows as CSV safely protected against formula injection
   */
  public static exportToCsv(
    filename: string,
    columns: { name: string }[],
    rows: Record<string, unknown>[]
  ): void {
    if (rows.length === 0) return;

    const headers = columns.map(c => `"${c.name.replace(/"/g, '""')}"`).join(',');
    const csvRows = rows.map(r =>
      columns.map(c => this.sanitizeCsvCell(r[c.name])).join(',')
    );

    const csvContent = [headers, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename || 'query_data'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Copies configuration as JSON to clipboard
   */
  public static async copyConfig(config: ChartConfig): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Downloads chart SVG container as PNG image
   */
  public static async downloadChartAsPng(containerElement: HTMLElement, filename = 'datapilot_chart'): Promise<void> {
    const svgElement = containerElement.querySelector('svg');
    if (!svgElement) {
      throw new Error('Chart SVG not found for export.');
    }

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = window.URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const rect = svgElement.getBoundingClientRect();
      canvas.width = (rect.width || 800) * 2; // 2x for Retina resolution
      canvas.height = (rect.height || 500) * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.fillStyle = '#0b0f19'; // dark background matching slate-950
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, rect.width || 800, rect.height || 500);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `${filename}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      window.URL.revokeObjectURL(blobURL);
    };

    image.src = blobURL;
  }
}
