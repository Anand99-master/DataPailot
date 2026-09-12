import { Dashboard, DashboardWidget, DashboardFilter } from '../types/dashboard';
import { QueryResult, DiscoveredTable } from '../types/database';
import { DatabaseApiClient } from './databaseApi';
import { DashboardFilterEngine } from './dashboardFilterEngine';

export interface WidgetRefreshResult {
  widgetId: string;
  status: 'success' | 'error' | 'schema_changed';
  result?: QueryResult;
  errorMessage?: string;
  schemaChangeDetails?: {
    missingTable?: string;
    missingColumn?: string;
    description?: string;
  };
}

export interface DashboardRefreshSummary {
  updatedAt: string;
  results: Map<string, WidgetRefreshResult>;
  totalWidgets: number;
  successCount: number;
  errorCount: number;
  schemaChangedCount: number;
}

export class DashboardRefreshService {
  /**
   * Centralized refresh engine: executes required widget queries,
   * dedupes identical queries to reduce database load,
   * applies active dashboard filters safely, and detects schema changes.
   */
  public static async refreshDashboard(
    dashboard: Dashboard,
    activeFilters: DashboardFilter[] = [],
    discoveredTables: DiscoveredTable[] = [],
    abortSignal?: AbortSignal
  ): Promise<DashboardRefreshSummary> {
    const results = new Map<string, WidgetRefreshResult>();
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (dashboard.widgets.length === 0) {
      return {
        updatedAt: timeFormatted,
        results,
        totalWidgets: 0,
        successCount: 0,
        errorCount: 0,
        schemaChangedCount: 0
      };
    }

    // Step 1: Pre-flight schema validation against live discoveredTables
    const knownTablesMap = new Map<string, Set<string>>();
    for (const t of discoveredTables) {
      const colSet = new Set<string>();
      // t.name is standard
      knownTablesMap.set(t.name.toLowerCase(), colSet);
    }

    // Map each widget to its final SQL (after filters)
    interface WidgetExecutionPlan {
      widget: DashboardWidget;
      finalSql: string;
      schemaIssue?: { missingTable?: string; missingColumn?: string; description?: string };
    }

    const plans: WidgetExecutionPlan[] = [];

    for (const widget of dashboard.widgets) {
      // Check if source table is still present in schema (if known)
      if (widget.queryRef.sourceTable && discoveredTables.length > 0) {
        const tblLower = widget.queryRef.sourceTable.toLowerCase();
        if (!knownTablesMap.has(tblLower)) {
          plans.push({
            widget,
            finalSql: widget.queryRef.sql,
            schemaIssue: {
              missingTable: widget.queryRef.sourceTable,
              description: `The table '${widget.queryRef.sourceTable}' is no longer present in the database.`
            }
          });
          continue;
        }
      }

      // Check if critical chart dimension or measure is in referencedColumns and missing
      const baseSql = widget.queryRef.sql || '';
      const { augmentedSql } = DashboardFilterEngine.applyFiltersToSql(
        baseSql,
        activeFilters,
        widget,
        widget.cachedResult?.columns
      );

      plans.push({
        widget,
        finalSql: augmentedSql
      });
    }

    // Step 2: Query Deduplication within this refresh cycle
    // Group widgets that share the identical final SQL string
    const queryGroups = new Map<string, WidgetExecutionPlan[]>();
    for (const plan of plans) {
      if (plan.schemaIssue) {
        // Record schema changed directly without executing
        results.set(plan.widget.id, {
          widgetId: plan.widget.id,
          status: 'schema_changed',
          schemaChangeDetails: plan.schemaIssue,
          errorMessage: plan.schemaIssue.description
        });
        continue;
      }

      const sqlKey = plan.finalSql.trim();
      if (!queryGroups.has(sqlKey)) {
        queryGroups.set(sqlKey, []);
      }
      queryGroups.get(sqlKey)!.push(plan);
    }

    // Step 3: Execute unique queries safely
    let successCount = 0;
    let errorCount = 0;
    let schemaChangedCount = Array.from(results.values()).filter(r => r.status === 'schema_changed').length;

    for (const [sql, group] of Array.from(queryGroups.entries())) {
      if (abortSignal?.aborted) break;

      try {
        const queryRes = await DatabaseApiClient.executeQuery(sql, 1000, abortSignal);

        if (queryRes.status === 'success') {
          successCount += group.length;
          for (const item of group) {
            results.set(item.widget.id, {
              widgetId: item.widget.id,
              status: 'success',
              result: queryRes
            });
          }
        } else {
          // Check if error message indicates schema drift
          const errMsg = queryRes.errorMessage || 'Query execution failed';
          const isSchemaDrift =
            errMsg.toLowerCase().includes('column') && errMsg.toLowerCase().includes('does not exist') ||
            errMsg.toLowerCase().includes('relation') && errMsg.toLowerCase().includes('does not exist') ||
            errMsg.toLowerCase().includes('table') && errMsg.toLowerCase().includes('not found');

          if (isSchemaDrift) {
            schemaChangedCount += group.length;
            for (const item of group) {
              results.set(item.widget.id, {
                widgetId: item.widget.id,
                status: 'schema_changed',
                errorMessage: errMsg,
                schemaChangeDetails: {
                  description: `Database schema changed: ${errMsg}`
                }
              });
            }
          } else {
            errorCount += group.length;
            for (const item of group) {
              results.set(item.widget.id, {
                widgetId: item.widget.id,
                status: 'error',
                errorMessage: errMsg
              });
            }
          }
        }
      } catch (err: any) {
        const msg = err.message || 'Database execution failed';
        errorCount += group.length;
        for (const item of group) {
          results.set(item.widget.id, {
            widgetId: item.widget.id,
            status: 'error',
            errorMessage: msg
          });
        }
      }
    }

    return {
      updatedAt: timeFormatted,
      results,
      totalWidgets: dashboard.widgets.length,
      successCount,
      errorCount,
      schemaChangedCount
    };
  }

  /**
   * Refreshes a single widget with active filters and schema validation
   */
  public static async refreshSingleWidget(
    widget: DashboardWidget,
    activeFilters: DashboardFilter[] = [],
    discoveredTables: DiscoveredTable[] = []
  ): Promise<WidgetRefreshResult> {
    const singleDashboard: Dashboard = {
      id: 'temp-single',
      name: 'Single Widget Temp',
      widgets: [widget],
      filters: [],
      layout: { columns: 12, gap: 'md' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      autoRefreshInterval: 0
    };
    const summary = await this.refreshDashboard(singleDashboard, activeFilters, discoveredTables);
    return summary.results.get(widget.id) || {
      widgetId: widget.id,
      status: 'error',
      errorMessage: 'Widget could not be refreshed'
    };
  }
}
