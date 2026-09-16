import { SavedPipeline, TransformStep, PipelineVersionSnapshot } from '../types/cleaning';
import { PipelineValidator } from './pipelineValidator';

const STORAGE_KEY = 'datapilot_saved_pipelines_v1';

export class PipelineStorage {
  private static workspaceId: string = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_active_workspace_id')) || 'ws_primary';
  private static projectId: string | null = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_active_project_id')) || null;

  public static setWorkspaceId(id: string) {
    this.workspaceId = id;
  }

  public static getWorkspaceId(): string {
    return this.workspaceId;
  }

  public static setProjectId(id: string | null) {
    this.projectId = id && id.trim() && id !== 'null' && id !== 'undefined' ? id.trim() : null;
  }

  public static getProjectId(): string | null {
    return this.projectId;
  }

  private static getStorageKey(): string {
    return `${STORAGE_KEY}_${this.workspaceId}${this.projectId ? `_${this.projectId}` : ''}`;
  }

  /**
   * Retrieves all saved pipelines from localStorage
   */
  public static getSavedPipelines(): SavedPipeline[] {
    try {
      let raw = localStorage.getItem(this.getStorageKey());
      // Backward compatibility for primary workspace without project
      if (!raw && this.workspaceId === 'ws_primary' && !this.projectId) {
        raw = localStorage.getItem(STORAGE_KEY);
      }
      if (!raw) return this.getDefaultPipelines();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return this.getDefaultPipelines();
    } catch {
      return this.getDefaultPipelines();
    }
  }

  /**
   * Saves or updates a pipeline. If updating an existing pipeline with changed steps, creates a new version snapshot.
   */
  public static savePipeline(
    name: string,
    steps: TransformStep[],
    options?: {
      id?: string;
      description?: string;
      sourceDatasetId?: string;
      sourceDatasetName?: string;
      createNewVersion?: boolean;
    }
  ): SavedPipeline {
    const pipelines = this.getSavedPipelines();
    const now = new Date().toISOString();
    const requiredColumns = PipelineValidator.extractRequiredColumns(steps);

    let target = options?.id ? pipelines.find(p => p.id === options.id) : null;

    if (target) {
      // Update existing pipeline
      const currentVer = target.version || 1;
      const newVer = options?.createNewVersion ? currentVer + 1 : currentVer;

      const history = target.versions || [
        {
          version: currentVer,
          name: target.name,
          description: target.description,
          steps: target.steps,
          updatedAt: target.updatedAt
        }
      ];

      if (options?.createNewVersion) {
        history.push({
          version: newVer,
          name: name.trim(),
          description: options?.description || target.description,
          steps: steps.map(s => ({ ...s })),
          updatedAt: now
        });
      }

      target.name = name.trim();
      target.description = options?.description !== undefined ? options.description : target.description;
      target.steps = steps.map(s => ({ ...s }));
      target.version = newVer;
      target.versions = history;
      target.requiredColumns = requiredColumns;
      target.updatedAt = now;
      if (options?.sourceDatasetId) target.sourceDatasetId = options.sourceDatasetId;
      if (options?.sourceDatasetName) target.sourceDatasetName = options.sourceDatasetName;
    } else {
      // Create new pipeline
      const newId = `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      target = {
        id: newId,
        name: name.trim(),
        description: options?.description || '',
        sourceDatasetId: options?.sourceDatasetId,
        sourceDatasetName: options?.sourceDatasetName,
        version: 1,
        versions: [
          {
            version: 1,
            name: name.trim(),
            description: options?.description || '',
            steps: steps.map(s => ({ ...s })),
            updatedAt: now
          }
        ],
        steps: steps.map(s => ({ ...s })),
        requiredColumns,
        createdAt: now,
        updatedAt: now
      };
      pipelines.push(target);
    }

    this.persist(pipelines);
    return target;
  }

  /**
   * Restores an earlier version snapshot of a saved pipeline
   */
  public static restoreVersion(pipelineId: string, versionNumber: number): SavedPipeline | null {
    const pipelines = this.getSavedPipelines();
    const target = pipelines.find(p => p.id === pipelineId);
    if (!target || !target.versions) return null;

    const snap = target.versions.find(v => v.version === versionNumber);
    if (!snap) return null;

    target.steps = snap.steps.map(s => ({ ...s }));
    target.version = snap.version;
    target.updatedAt = new Date().toISOString();
    target.requiredColumns = PipelineValidator.extractRequiredColumns(target.steps);

    this.persist(pipelines);
    return target;
  }

  /**
   * Renames a saved pipeline
   */
  public static renamePipeline(id: string, newName: string): boolean {
    const pipelines = this.getSavedPipelines();
    const target = pipelines.find(p => p.id === id);
    if (!target) return false;

    target.name = newName.trim();
    target.updatedAt = new Date().toISOString();
    this.persist(pipelines);
    return true;
  }

  /**
   * Duplicates a saved pipeline
   */
  public static duplicatePipeline(id: string, customName?: string): SavedPipeline | null {
    const pipelines = this.getSavedPipelines();
    const source = pipelines.find(p => p.id === id);
    if (!source) return null;

    const now = new Date().toISOString();
    const newId = `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const copy: SavedPipeline = {
      ...source,
      id: newId,
      name: customName?.trim() || `${source.name} (Copy)`,
      version: 1,
      versions: [
        {
          version: 1,
          name: customName?.trim() || `${source.name} (Copy)`,
          description: source.description,
          steps: source.steps.map(s => ({ ...s, id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })),
          updatedAt: now
        }
      ],
      steps: source.steps.map(s => ({ ...s, id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` })),
      createdAt: now,
      updatedAt: now
    };

    pipelines.push(copy);
    this.persist(pipelines);
    return copy;
  }

  /**
   * Deletes a saved pipeline
   */
  public static deletePipeline(id: string): boolean {
    const pipelines = this.getSavedPipelines();
    const filtered = pipelines.filter(p => p.id !== id);
    if (filtered.length === pipelines.length) return false;

    this.persist(filtered);
    return true;
  }

  private static persist(pipelines: SavedPipeline[]) {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(pipelines));
    } catch {
      // Ignored
    }
  }

  /**
   * Default seeded pipelines for out-of-the-box utility
   */
  private static getDefaultPipelines(): SavedPipeline[] {
    const defaults: SavedPipeline[] = [
      {
        id: 'pipe_ecommerce_standard',
        name: 'Ecommerce Order Standardization',
        description: 'Standardizes customer names, trims strings, fills missing discounts with 0, and calculates net revenue.',
        version: 1,
        versions: [
          {
            version: 1,
            name: 'Ecommerce Order Standardization',
            description: 'Standardizes customer names, trims strings, fills missing discounts with 0, and calculates net revenue.',
            steps: [
              {
                id: 'def_step_1',
                type: 'TEXT_CLEAN',
                column: 'Customer_Name',
                description: 'Trim whitespace and collapse multiple spaces in Customer_Name',
                params: { column: 'Customer_Name', trim: true, collapseSpaces: true, caseTransform: 'title' },
                enabled: true,
                createdAt: new Date().toISOString()
              },
              {
                id: 'def_step_2',
                type: 'REMOVE_DUPLICATES',
                description: 'Remove duplicate rows keeping first occurrence',
                params: { columns: [], keep: 'first' },
                enabled: true,
                createdAt: new Date().toISOString()
              },
              {
                id: 'def_step_3',
                type: 'FILL_MISSING',
                column: 'Discount',
                description: 'Fill missing values in Discount with 0',
                params: { column: 'Discount', strategy: 'zero', customValue: 0 },
                enabled: true,
                createdAt: new Date().toISOString()
              }
            ],
            updatedAt: new Date().toISOString()
          }
        ],
        steps: [
          {
            id: 'def_step_1',
            type: 'TEXT_CLEAN',
            column: 'Customer_Name',
            description: 'Trim whitespace and collapse multiple spaces in Customer_Name',
            params: { column: 'Customer_Name', trim: true, collapseSpaces: true, caseTransform: 'title' },
            enabled: true,
            createdAt: new Date().toISOString()
          },
          {
            id: 'def_step_2',
            type: 'REMOVE_DUPLICATES',
            description: 'Remove duplicate rows keeping first occurrence',
            params: { columns: [], keep: 'first' },
            enabled: true,
            createdAt: new Date().toISOString()
          },
          {
            id: 'def_step_3',
            type: 'FILL_MISSING',
            column: 'Discount',
            description: 'Fill missing values in Discount with 0',
            params: { column: 'Discount', strategy: 'zero', customValue: 0 },
            enabled: true,
            createdAt: new Date().toISOString()
          }
        ],
        requiredColumns: ['Customer_Name', 'Discount'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return defaults;
  }
}
