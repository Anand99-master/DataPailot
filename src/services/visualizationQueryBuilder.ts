import { ChartType, AggregationType, SortOrder, ChartLimit } from '../types/visualization';

export interface AnalyticalQueryOptions {
  tableName: string;
  schema?: string;
  dimension?: string;
  measure?: string;
  secondaryMeasures?: string[];
  aggregation?: AggregationType | 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'none';
  chartType: ChartType;
  sortOrder?: SortOrder;
  sortBy?: 'x' | 'y';
  limit?: ChartLimit | number;
  dialect?: 'sqlite' | 'postgres' | 'mysql' | 'mssql' | 'oracle';
}

export class VisualizationQueryBuilder {
  /**
   * Safely quotes an SQL identifier (column or table) for the selected dialect
   */
  public static quoteIdentifier(identifier: string, dialect: string = 'sqlite'): string {
    if (!identifier) return '';
    // If already safely formatted as *
    if (identifier === '*') return '*';

    // Standard double-quote for SQLite / Postgres / Oracle
    if (dialect === 'mysql') {
      return `\`${identifier.replace(/`/g, '``')}\``;
    }
    if (dialect === 'mssql') {
      return `[${identifier.replace(/\]/g, ']]')}]`;
    }

    // SQLite / PostgreSQL
    // If pure alphanumeric with underscore, we can use clean identifier or quoted
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Generates a clean column alias from aggregation and measure name
   */
  public static generateMeasureAlias(measure: string, aggregation: string, tableName?: string): string {
    const isAllRows = !measure || measure === '*' || measure === 'All Rows';
    const cleanMeasure = isAllRows ? '' : measure.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const aggUpper = aggregation.toUpperCase();

    if (aggUpper === 'COUNT') {
      if (cleanMeasure.includes('order') || cleanMeasure === 'order_id') {
        return 'total_orders';
      }
      if (cleanMeasure.includes('customer') || cleanMeasure === 'customer_id') {
        return 'total_customers';
      }
      if (isAllRows) {
        return 'total_orders';
      }
      return cleanMeasure ? `total_${cleanMeasure}` : 'total_orders';
    }

    if (aggUpper === 'SUM') {
      return `total_${cleanMeasure || 'sum'}`;
    }

    if (aggUpper === 'AVG') {
      return `avg_${cleanMeasure || 'avg'}`;
    }

    if (aggUpper === 'MIN') {
      return `min_${cleanMeasure || 'min'}`;
    }

    if (aggUpper === 'MAX') {
      return `max_${cleanMeasure || 'max'}`;
    }

    return cleanMeasure || 'value';
  }

  /**
   * Builds the SQL aggregation expression, e.g. COUNT(*), COUNT("Order_ID"), SUM("Sales"), etc.
   */
  public static buildAggregationExpression(
    measure: string | undefined,
    aggregation: string = 'none',
    dialect: string = 'sqlite',
    tableName?: string
  ): { expression: string; alias: string } {
    const aggUpper = (aggregation || 'none').toUpperCase();
    const isAllRows = !measure || measure === '*' || measure === 'All Rows';
    const safeMeasure = !isAllRows && measure ? this.quoteIdentifier(measure, dialect) : '';
    const alias = this.generateMeasureAlias(measure || '', aggUpper, tableName);

    switch (aggUpper) {
      case 'COUNT': {
        if (isAllRows) {
          return { expression: 'COUNT(*)', alias };
        }
        return { expression: `COUNT(${safeMeasure})`, alias };
      }
      case 'SUM': {
        return {
          expression: `SUM(${safeMeasure || 1})`,
          alias
        };
      }
      case 'AVG': {
        if (dialect === 'sqlite' || dialect === 'mysql' || dialect === 'oracle') {
          return {
            expression: `ROUND(AVG(${safeMeasure}), 2)`,
            alias
          };
        }
        if (dialect === 'mssql') {
          return {
            expression: `ROUND(AVG(CAST(${safeMeasure} AS FLOAT)), 2)`,
            alias
          };
        }
        return {
          expression: `ROUND(AVG(${safeMeasure})::numeric, 2)`,
          alias
        };
      }
      case 'MIN': {
        return {
          expression: `MIN(${safeMeasure})`,
          alias
        };
      }
      case 'MAX': {
        return {
          expression: `MAX(${safeMeasure})`,
          alias
        };
      }
      default: {
        return {
          expression: safeMeasure || '*',
          alias: measure || 'value'
        };
      }
    }
  }

  /**
   * Generates a fully executable analytical SQL query tailored for the dataset
   */
  public static buildQuery(options: AnalyticalQueryOptions): string {
    const {
      tableName,
      dimension,
      measure,
      aggregation = 'none',
      chartType,
      sortOrder = 'none',
      limit = 50,
      dialect = 'sqlite'
    } = options;

    const safeTable = this.quoteIdentifier(tableName, dialect);
    const aggUpper = (aggregation || 'none').toUpperCase();

    // 1. KPI Card View
    if (chartType === 'kpi') {
      const { expression, alias } = this.buildAggregationExpression(
        measure,
        aggUpper === 'NONE' ? 'COUNT' : aggUpper,
        dialect,
        tableName
      );
      return `SELECT ${expression} AS ${this.quoteIdentifier(alias, dialect)} FROM ${safeTable};`;
    }

    // 2. Scatter Plot View
    if (chartType === 'scatter') {
      const xCol = dimension ? this.quoteIdentifier(dimension, dialect) : '';
      const yCol = measure ? this.quoteIdentifier(measure, dialect) : '';
      const limitNum = typeof limit === 'number' ? limit : 500;

      if (xCol && yCol) {
        return `SELECT ${xCol} AS ${xCol}, ${yCol} AS ${yCol} FROM ${safeTable} WHERE ${xCol} IS NOT NULL AND ${yCol} IS NOT NULL LIMIT ${limitNum};`;
      }
      return `SELECT * FROM ${safeTable} LIMIT ${limitNum};`;
    }

    // 3. Histogram View
    if (chartType === 'histogram') {
      const histCol = measure || dimension;
      const safeHist = histCol ? this.quoteIdentifier(histCol, dialect) : '';
      const limitNum = typeof limit === 'number' ? limit : 1000;
      if (safeHist) {
        return `SELECT ${safeHist} AS "value" FROM ${safeTable} WHERE ${safeHist} IS NOT NULL LIMIT ${limitNum};`;
      }
      return `SELECT * FROM ${safeTable} LIMIT ${limitNum};`;
    }

    // 4. Tabular View (without grouping if no dimension or raw requested)
    if (chartType === 'table' && !dimension) {
      const limitNum = typeof limit === 'number' ? limit : 100;
      return `SELECT * FROM ${safeTable} LIMIT ${limitNum};`;
    }

    // 5. Standard Aggregated Charts (Bar, Horizontal Bar, Line, Area, Pie, Donut, or Grouped Table)
    if (dimension) {
      const safeDim = this.quoteIdentifier(dimension, dialect);
      const effectiveAgg = aggUpper === 'NONE' ? 'COUNT' : aggUpper;
      const { expression, alias } = this.buildAggregationExpression(measure, effectiveAgg, dialect, tableName);
      const safeAlias = this.quoteIdentifier(alias, dialect);

      let orderClause = '';
      if (sortOrder === 'asc') {
        orderClause = `ORDER BY ${safeAlias} ASC`;
      } else if (sortOrder === 'desc' || sortOrder === 'none') {
        orderClause = `ORDER BY ${safeAlias} DESC`;
      }

      let limitClause = '';
      let parsedLimit: number | null = null;
      if (typeof limit === 'number') {
        parsedLimit = limit;
      } else if (limit !== 'all') {
        const parsed = parseInt(String(limit), 10);
        if (!isNaN(parsed) && parsed > 0) {
          parsedLimit = parsed;
        }
      }

      if (parsedLimit !== null) {
        if (dialect === 'mssql') {
          if (!orderClause) {
            orderClause = `ORDER BY ${safeAlias} DESC`;
          }
          limitClause = `OFFSET 0 ROWS FETCH NEXT ${parsedLimit} ROWS ONLY`;
        } else if (dialect === 'oracle') {
          limitClause = `FETCH FIRST ${parsedLimit} ROWS ONLY`;
        } else {
          limitClause = `LIMIT ${parsedLimit}`;
        }
      }

      const parts = [
        `SELECT`,
        `    ${safeDim},`,
        `    ${expression} AS ${safeAlias}`,
        `FROM ${safeTable}`,
        `GROUP BY ${safeDim}`,
        orderClause,
        limitClause
      ].filter(Boolean);

      return `${parts.join('\n')};`;
    }

    // Fallback: simple preview limit
    const limitNum = typeof limit === 'number' ? limit : 50;
    return `SELECT * FROM ${safeTable} LIMIT ${limitNum};`;
  }
}
