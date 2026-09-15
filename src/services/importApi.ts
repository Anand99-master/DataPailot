import {
  ImportedDataset,
  ImportValidationResult,
  OperationSupportStatus,
  ExportFormat,
  FileType
} from '../types/import';

export class ImportApiClient {
  private static workspaceId: string = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_active_workspace_id')) || 'ws_primary';

  public static setWorkspaceId(id: string) {
    this.workspaceId = id;
  }

  public static getWorkspaceId(): string {
    return this.workspaceId;
  }

  private static getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'x-workspace-id': this.workspaceId,
      ...extraHeaders
    };
  }

  /**
   * Helper to convert a browser File object to Base64 string
   */
  public static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix e.g. "data:application/...;base64,"
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Helper to read a browser File as UTF-8 text
   */
  public static async fileToText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsText(file, 'utf-8');
    });
  }

  /**
   * Validates and generates a preview of the file before full import
   */
  public static async validateAndPreview(
    file: File,
    options: { selectedSheet?: string } = {}
  ): Promise<ImportValidationResult> {
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    let payload: Record<string, unknown>;
    if (isXlsx) {
      const contentBase64 = await this.fileToBase64(file);
      payload = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        contentBase64,
        selectedSheet: options.selectedSheet
      };
    } else {
      const contentText = await this.fileToText(file);
      payload = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        contentText,
        selectedSheet: options.selectedSheet
      };
    }

    const res = await fetch('/api/import/validate-and-preview', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Validation failed');
    }

    return data;
  }

  /**
   * Confirms the import and registers the dataset in the Unified Data Layer
   */
  public static async confirmImport(params: {
    fileName: string;
    datasetName?: string;
    fileType?: FileType;
    file?: File;
    contentText?: string;
    contentBase64?: string;
    selectedSheet?: string;
  }): Promise<ImportedDataset> {
    let contentBase64 = params.contentBase64;
    let contentText = params.contentText;

    if (params.file) {
      const isXlsx = params.file.name.endsWith('.xlsx') || params.file.name.endsWith('.xls');
      if (isXlsx) {
        contentBase64 = await this.fileToBase64(params.file);
      } else {
        contentText = await this.fileToText(params.file);
      }
    }

    const res = await fetch('/api/import/confirm', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        fileName: params.fileName,
        datasetName: params.datasetName,
        fileType: params.fileType,
        contentText,
        contentBase64,
        selectedSheet: params.selectedSheet
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Import failed');
    }

    return data.dataset;
  }

  /**
   * Lists all imported datasets
   */
  public static async getDatasets(): Promise<ImportedDataset[]> {
    const res = await fetch('/api/import/datasets', {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch datasets');
    }
    return data.datasets || [];
  }

  /**
   * Retrieves a single dataset with profile and preview
   */
  public static async getDataset(datasetId: string): Promise<ImportedDataset> {
    const res = await fetch(`/api/import/datasets/${encodeURIComponent(datasetId)}`, {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch dataset');
    }
    return data.dataset;
  }

  /**
   * Renames an imported dataset
   */
  public static async renameDataset(datasetId: string, name: string): Promise<ImportedDataset> {
    const res = await fetch(`/api/import/datasets/${encodeURIComponent(datasetId)}`, {
      method: 'PATCH',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to rename dataset');
    }
    return data.dataset;
  }

  /**
   * Removes an imported dataset
   */
  public static async removeDataset(datasetId: string): Promise<void> {
    const res = await fetch(`/api/import/datasets/${encodeURIComponent(datasetId)}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete dataset');
    }
  }

  /**
   * Retrieves capability support matrix
   */
  public static async getCapabilities(): Promise<OperationSupportStatus[]> {
    const res = await fetch('/api/import/capabilities', {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch capabilities');
    }
    return data.capabilities || [];
  }

  /**
   * Triggers export and browser file download with formula injection safety
   */
  public static async exportDataset(datasetId: string, format: ExportFormat): Promise<void> {
    const res = await fetch('/api/import/export', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ datasetId, format })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to export dataset as ${format.toUpperCase()}`);
    }

    const blob = await res.blob();
    const contentDisposition = res.headers.get('Content-Disposition') || '';
    const match = contentDisposition.match(/filename="?([^";]+)"?/);
    const fileName = match ? match[1] : `dataset_export.${format}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
