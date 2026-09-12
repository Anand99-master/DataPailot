import { DetectedColumn, VisualizationInsight, ChartConfig } from '../types/visualization';
import { DatabaseApiClient } from './databaseApi';
import { VisualizationDataProcessor } from './visualizationDataProcessor';

export class VisualizationInsightsService {
  /**
   * Generates factual, numbers-grounded insights.
   * Leverages Gemini AI when configured, with a deterministic statistical fallback.
   */
  public static async generateInsights(
    query: string,
    rows: Record<string, unknown>[],
    columns: DetectedColumn[],
    config: ChartConfig,
    isAiConfigured: boolean
  ): Promise<VisualizationInsight[]> {
    if (!rows || rows.length === 0) {
      return [
        {
          title: 'Empty Dataset',
          type: 'summary',
          text: 'No data rows were returned for this query to derive statistical insights.'
        }
      ];
    }

    // Always compute deterministic factual baseline first
    const statisticalInsights = this.computeFactualStatistics(rows, columns, config);

    if (!isAiConfigured) {
      return statisticalInsights;
    }

    // AI Enrichment if available
    try {
      const aiResult = await DatabaseApiClient.explainResultsWithAi(
        query || 'SELECT * FROM data',
        columns.map(c => ({ name: c.name, type: c.dataType })),
        rows.slice(0, 30),
        rows.length,
        0
      );

      const combined: VisualizationInsight[] = [];

      if (aiResult.summary) {
        combined.push({
          title: 'Overview Summary',
          type: 'summary',
          text: aiResult.summary
        });
      }

      if (aiResult.keyInsights && aiResult.keyInsights.length > 0) {
        aiResult.keyInsights.forEach((insight, idx) => {
          combined.push({
            title: `Key Finding #${idx + 1}`,
            type: 'extreme',
            text: insight
          });
        });
      }

      if (aiResult.dataTrends && aiResult.dataTrends.length > 0) {
        aiResult.dataTrends.forEach(trend => {
          combined.push({
            title: 'Pattern & Distribution',
            type: 'trend',
            text: trend
          });
        });
      }

      return combined.length > 0 ? combined : statisticalInsights;
    } catch {
      // Graceful fallback to deterministic factual statistics
      return statisticalInsights;
    }
  }

  /**
   * Deterministically computes factual metrics: highest, lowest, average, concentration, trends
   */
  private static computeFactualStatistics(
    rows: Record<string, unknown>[],
    columns: DetectedColumn[],
    config: ChartConfig
  ): VisualizationInsight[] {
    const insights: VisualizationInsight[] = [];
    const measureCol = config.yAxis || columns.find(c => c.isNumeric)?.name;
    const dimCol = config.xAxis || columns.find(c => !c.isNumeric)?.name;

    if (!measureCol) {
      return [
        {
          title: 'Record Count',
          type: 'summary',
          text: `The query returned ${rows.length} records across ${columns.length} columns.`
        }
      ];
    }

    // 1. Extreme Values (Max & Min)
    let maxVal = -Infinity;
    let minVal = Infinity;
    let maxLabel = '';
    let minLabel = '';
    let sum = 0;
    let validCount = 0;

    for (const r of rows) {
      const raw = r[measureCol];
      if (raw !== null && raw !== undefined) {
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
        if (!isNaN(num)) {
          validCount++;
          sum += num;

          const label = dimCol && r[dimCol] !== undefined ? String(r[dimCol]) : `Row #${validCount}`;

          if (num > maxVal) {
            maxVal = num;
            maxLabel = label;
          }
          if (num < minVal) {
            minVal = num;
            minLabel = label;
          }
        }
      }
    }

    if (validCount > 0) {
      const avg = sum / validCount;

      insights.push({
        title: 'Dataset Volume & Totals',
        type: 'summary',
        text: `Analyzed ${validCount} entries for '${measureCol}'. Total sum is ${VisualizationDataProcessor.formatNumber(
          sum
        )}, with an average of ${VisualizationDataProcessor.formatNumber(avg)} per record.`
      });

      insights.push({
        title: 'Extremes & Peak Values',
        type: 'extreme',
        text: `Highest '${measureCol}' is ${VisualizationDataProcessor.formatNumber(
          maxVal
        )} (recorded at ${maxLabel}). Lowest is ${VisualizationDataProcessor.formatNumber(
          minVal
        )} (recorded at ${minLabel}).`,
        evidence: `Max: ${maxVal}, Min: ${minVal}`
      });

      // 2. Category Concentration (Pareto / Largest share)
      if (dimCol && sum > 0 && maxVal > 0) {
        const topShare = ((maxVal / sum) * 100).toFixed(1);
        insights.push({
          title: 'Concentration Share',
          type: 'distribution',
          text: `'${maxLabel}' accounts for ${topShare}% of the total '${measureCol}' in this result set.`
        });
      }

      // 3. Trend detection if chronologically ordered
      const dateCol = columns.find(c => c.isDateOrTime);
      if (dateCol && rows.length >= 3 && dimCol === dateCol.name) {
        const firstVal = parseFloat(String(rows[0][measureCol]));
        const lastVal = parseFloat(String(rows[rows.length - 1][measureCol]));

        if (!isNaN(firstVal) && !isNaN(lastVal) && firstVal > 0) {
          const deltaPct = (((lastVal - firstVal) / firstVal) * 100).toFixed(1);
          const direction = lastVal >= firstVal ? 'increased' : 'decreased';
          insights.push({
            title: 'Temporal Trajectory',
            type: 'trend',
            text: `'${measureCol}' has ${direction} by ${Math.abs(
              parseFloat(deltaPct)
            )}% from the first period (${rows[0][dimCol]}) to the latest period (${
              rows[rows.length - 1][dimCol]
            }).`
          });
        }
      }
    }

    return insights;
  }
}
