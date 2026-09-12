import {
  DetectedColumn,
  ChartType,
  ChartRecommendation,
  ChartValidationResult,
  ChartConfig
} from '../types/visualization';

export class ChartRecommender {
  /**
   * Intelligently selects the best default visualization based on result metadata
   */
  public static recommend(
    columns: DetectedColumn[],
    rowCount: number
  ): ChartRecommendation {
    if (columns.length === 0 || rowCount === 0) {
      return {
        chartType: 'table',
        confidence: 'low',
        reason: 'No columns or records available for visualization.'
      };
    }

    const numericCols = columns.filter(c => c.isNumeric);
    const dateCols = columns.filter(c => c.isDateOrTime);
    const categoricalCols = columns.filter(c => c.isCategorical && !c.isDateOrTime);

    // Rule 1: Single numeric result (1 row, 1 numeric column or 2 columns with current/previous) -> KPI Card
    if (rowCount === 1 && numericCols.length >= 1) {
      const primaryMetric = numericCols[0].name;
      return {
        chartType: 'kpi',
        confidence: 'high',
        reason: 'Single numeric aggregation detected, ideal for high-impact metric presentation.',
        yAxis: primaryMetric,
        title: primaryMetric.replace(/_/g, ' ').toUpperCase()
      };
    }

    // Rule 1b: 1-2 rows with metric columns (like current vs previous) -> KPI Card
    if (rowCount <= 2 && numericCols.length === 1 && columns.length <= 2) {
      return {
        chartType: 'kpi',
        confidence: 'high',
        reason: 'Summary metric detected, recommended as KPI Card.',
        yAxis: numericCols[0].name,
        title: numericCols[0].name.replace(/_/g, ' ').toUpperCase()
      };
    }

    // Rule 2: Date + multiple numeric measures -> Multi-series Line Chart
    if (dateCols.length >= 1 && numericCols.length > 1) {
      const dateCol = dateCols[0].name;
      const primaryMeasure = numericCols[0].name;
      const secondaryMeasures = numericCols.slice(1).map(c => c.name);
      return {
        chartType: 'line',
        confidence: 'high',
        reason: `Temporal trend detected on ${dateCol} with multiple numeric metrics. Multi-series Line Chart recommended.`,
        xAxis: dateCol,
        yAxis: primaryMeasure,
        secondaryMeasures,
        title: `${primaryMeasure.replace(/_/g, ' ')} over time`
      };
    }

    // Rule 3: Date + single numeric measure -> Line Chart
    if (dateCols.length >= 1 && numericCols.length === 1) {
      const dateCol = dateCols[0].name;
      const metricCol = numericCols[0].name;
      return {
        chartType: 'line',
        confidence: 'high',
        reason: `Chronological series (${dateCol}) mapped to measure (${metricCol}). Line Chart recommended.`,
        xAxis: dateCol,
        yAxis: metricCol,
        title: `${metricCol.replace(/_/g, ' ')} over ${dateCol.replace(/_/g, ' ')}`
      };
    }

    // Rule 4: Category + percentage / small categorical proportions -> Donut or Bar
    if (categoricalCols.length >= 1 && numericCols.length >= 1) {
      const catCol = categoricalCols[0];
      const metricCol = numericCols[0];

      // Check if percentage or small category count (<= 6 distinct values)
      const isPercentage =
        metricCol.name.toLowerCase().includes('percent') ||
        metricCol.name.toLowerCase().includes('share') ||
        metricCol.name.toLowerCase().includes('pct') ||
        metricCol.name.toLowerCase().includes('ratio');

      if (catCol.distinctCount <= 6 && (isPercentage || rowCount <= 6)) {
        return {
          chartType: 'donut',
          confidence: 'high',
          reason: `Categorical proportion (${catCol.name}) with ${catCol.distinctCount} categories. Donut Chart recommended.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          title: `Share of ${metricCol.name.replace(/_/g, ' ')} by ${catCol.name.replace(/_/g, ' ')}`
        };
      }

      // If multiple numeric measures with category -> Multi-metric Bar
      if (numericCols.length > 1) {
        return {
          chartType: 'bar',
          confidence: 'high',
          reason: `Categorical grouping (${catCol.name}) with multiple numeric metrics. Multi-series Bar Chart recommended.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          secondaryMeasures: numericCols.slice(1).map(c => c.name),
          title: `Metrics by ${catCol.name.replace(/_/g, ' ')}`
        };
      }

      // Standard Category + numeric -> Bar Chart
      return {
        chartType: 'bar',
        confidence: 'high',
        reason: `Categorical dimension (${catCol.name}) with numeric measure (${metricCol.name}). Bar Chart recommended.`,
        xAxis: catCol.name,
        yAxis: metricCol.name,
        title: `${metricCol.name.replace(/_/g, ' ')} by ${catCol.name.replace(/_/g, ' ')}`
      };
    }

    // Rule 5: Exactly two numeric columns (no dates, no categories) -> Scatter Plot
    if (numericCols.length >= 2 && categoricalCols.length === 0 && dateCols.length === 0) {
      return {
        chartType: 'scatter',
        confidence: 'high',
        reason: `Two continuous numeric variables (${numericCols[0].name} vs ${numericCols[1].name}). Scatter Plot recommended to examine correlation.`,
        xAxis: numericCols[0].name,
        yAxis: numericCols[1].name,
        title: `${numericCols[1].name.replace(/_/g, ' ')} vs ${numericCols[0].name.replace(/_/g, ' ')}`
      };
    }

    // Rule 6: Single numeric column with multiple records -> Histogram
    if (numericCols.length === 1 && categoricalCols.length === 0 && rowCount > 5) {
      return {
        chartType: 'histogram',
        confidence: 'medium',
        reason: `Single continuous numeric distribution (${numericCols[0].name}). Histogram recommended.`,
        xAxis: numericCols[0].name,
        yAxis: numericCols[0].name,
        title: `Distribution of ${numericCols[0].name.replace(/_/g, ' ')}`
      };
    }

    // Fallback: Table
    return {
      chartType: 'table',
      confidence: 'medium',
      reason: 'Standard tabular layout provides clearest representation for this dataset.',
      title: 'Query Data View'
    };
  }

  /**
   * Validates whether the chosen chart configuration is mathematically and structurally valid
   */
  public static validateConfig(
    config: ChartConfig,
    columns: DetectedColumn[]
  ): ChartValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.chartType === 'table') {
      return { isValid: true, errors, warnings };
    }

    const colMap = new Map(columns.map(c => [c.name, c]));
    const xCol = config.xAxis ? colMap.get(config.xAxis) : undefined;
    const yCol = config.yAxis ? colMap.get(config.yAxis) : undefined;

    // KPI Card validation
    if (config.chartType === 'kpi') {
      if (!yCol) {
        errors.push('KPI Card requires a metric column.');
      } else if (!yCol.isNumeric) {
        errors.push(`KPI metric '${config.yAxis}' must be numeric (detected as ${yCol.semanticType}).`);
      }
      return { isValid: errors.length === 0, errors, warnings };
    }

    // Histogram validation
    if (config.chartType === 'histogram') {
      const histCol = xCol || yCol;
      if (!histCol) {
        errors.push('Histogram requires a numeric column for binning.');
      } else if (!histCol.isNumeric) {
        errors.push(`Histogram column '${histCol.name}' must be numeric (detected as ${histCol.semanticType}).`);
      }
      return { isValid: errors.length === 0, errors, warnings };
    }

    // Scatter Plot validation
    if (config.chartType === 'scatter') {
      if (!xCol) {
        errors.push('Scatter plot requires an X-axis column.');
      } else if (!xCol.isNumeric) {
        errors.push(`Scatter plot X-axis '${config.xAxis}' must be numeric.`);
      }

      if (!yCol) {
        errors.push('Scatter plot requires a Y-axis column.');
      } else if (!yCol.isNumeric) {
        errors.push(`Scatter plot Y-axis '${config.yAxis}' must be numeric.`);
      }

      return { isValid: errors.length === 0, errors, warnings };
    }

    // Standard Charts (Bar, Horizontal Bar, Line, Area, Pie, Donut)
    if (!xCol) {
      errors.push('Please select a dimension or category for the X-axis.');
    }

    if (!yCol) {
      errors.push('Please select a numeric measure for the Y-axis.');
    } else if (!yCol.isNumeric) {
      errors.push(`Measure column '${config.yAxis}' must be numeric (detected as ${yCol.semanticType}).`);
    }

    // Pie / Donut specific checks
    if (config.chartType === 'pie' || config.chartType === 'donut') {
      if (xCol && xCol.distinctCount > 8) {
        warnings.push(
          `Pie charts work best with a small number of categories (selected '${xCol.name}' has ${xCol.distinctCount} distinct values). Consider a Bar Chart for clearer readability.`
        );
      }
    }

    // Check secondary measures if multi-series
    if (config.secondaryMeasures && config.secondaryMeasures.length > 0) {
      for (const mName of config.secondaryMeasures) {
        const mCol = colMap.get(mName);
        if (!mCol) {
          errors.push(`Secondary measure '${mName}' not found in query results.`);
        } else if (!mCol.isNumeric) {
          errors.push(`Secondary measure '${mName}' must be numeric.`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
