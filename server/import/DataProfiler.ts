import { ColumnMetadata, ColumnProfile, DataProfile } from '../../src/types/import';

export interface ProfilerOptions {
  maxRowsToProfile?: number;
  maxSampleRows?: number;
  mode?: 'auto' | 'exact' | 'sampled' | 'Exact' | 'Sampled';
  sampleSize?: number;
}

export class DataProfiler {
  /**
   * Generates a comprehensive statistical and structural profile of an imported dataset
   * Supporting both Exact and Sampled analysis modes for datasets up to 1,000,000+ rows.
   */
  public static profile(
    datasetId: string,
    datasetName: string,
    columns: ColumnMetadata[],
    rows: Record<string, unknown>[],
    options: number | ProfilerOptions = 50000
  ): DataProfile {
    const totalRows = rows.length;
    const totalColumns = columns.length;

    let sampleLimit = 50000;
    let mode: 'auto' | 'exact' | 'sampled' = 'auto';

    if (typeof options === 'number') {
      sampleLimit = options;
    } else if (options && typeof options === 'object') {
      if (options.maxSampleRows !== undefined) sampleLimit = options.maxSampleRows;
      else if (options.maxRowsToProfile !== undefined) sampleLimit = options.maxRowsToProfile;
      else if (options.sampleSize !== undefined) sampleLimit = options.sampleSize;
      
      if (options.mode) {
        const lowerMode = String(options.mode).toLowerCase();
        if (lowerMode === 'exact' || lowerMode === 'sampled') {
          mode = lowerMode as any;
        }
      }
    }

    // Determine sampling strategy based on thresholds:
    // Small/Medium (< 50,000 rows): Exact
    // Large (>= 50,000 rows): Sampled unless exact is explicitly requested
    const isSampled = mode === 'exact' ? false : (mode === 'sampled' || totalRows > sampleLimit);
    const effectiveLimit = Math.min(sampleLimit, totalRows);
    const sampledRows = isSampled ? rows.slice(0, effectiveLimit) : rows;
    const sampleSize = sampledRows.length;
    const samplePercentage = totalRows > 0 ? Math.round((sampleSize / totalRows) * 1000) / 10 : 100;
    const analysisMode: 'Exact' | 'Sampled' = isSampled ? 'Sampled' : 'Exact';

    const columnProfiles: Record<string, ColumnProfile> = {};

    for (let cIdx = 0; cIdx < columns.length; cIdx++) {
      const col = columns[cIdx];
      const colName = col.name;
      
      let nullCount = 0;
      let zeroCount = 0;
      let negativeCount = 0;
      const nonNulls: unknown[] = [];
      const distinctSet = new Set<unknown>();

      // Extract and scan values in a single fast loop
      for (let rIdx = 0; rIdx < sampleSize; rIdx++) {
        const v = sampledRows[rIdx][colName];
        if (v === null || v === undefined || v === '') {
          nullCount++;
        } else {
          nonNulls.push(v);
          if (distinctSet.size < 10000) {
            distinctSet.add(v);
          }
        }
      }

      // If sampled, estimate total counts proportionally with clear annotations
      const estimatedNullCount = isSampled && sampleSize > 0
        ? Math.round((nullCount / sampleSize) * totalRows)
        : nullCount;

      const nullPercentage = totalRows > 0 ? Math.round((estimatedNullCount / totalRows) * 1000) / 10 : 0;
      const uniqueCount = distinctSet.size;
      const uniquePercentage = nonNulls.length > 0
        ? Math.round((uniqueCount / nonNulls.length) * 1000) / 10
        : 0;

      const sampleValues = Array.from(distinctSet).slice(0, 5);

      const profile: ColumnProfile = {
        columnName: colName,
        dataType: col.dataType,
        nullCount: estimatedNullCount,
        nullPercentage,
        uniqueCount,
        uniquePercentage,
        sampleValues,
        isEstimated: isSampled,
        estimateNote: isSampled ? `Sample-based estimation (approximate metrics calculated from ${sampleSize.toLocaleString()} sample rows, ${samplePercentage}%)` : undefined
      };

      // Type-specific statistical analysis
      if (col.dataType === 'integer' || col.dataType === 'numeric') {
        const numValues: number[] = [];
        let sum = 0;

        for (let i = 0; i < nonNulls.length; i++) {
          const v = nonNulls[i];
          const num = typeof v === 'number' ? v : Number(v);
          if (!isNaN(num) && isFinite(num)) {
            numValues.push(num);
            sum += num;
            if (num === 0) zeroCount++;
            if (num < 0) negativeCount++;
          }
        }

        if (numValues.length > 0) {
          numValues.sort((a, b) => a - b);
          const min = numValues[0];
          const max = numValues[numValues.length - 1];
          const avg = Math.round((sum / numValues.length) * 100) / 100;

          // Median
          const mid = Math.floor(numValues.length / 2);
          const median = numValues.length % 2 !== 0
            ? numValues[mid]
            : Math.round(((numValues[mid - 1] + numValues[mid]) / 2) * 100) / 100;

          // Standard deviation
          let varianceSum = 0;
          for (let i = 0; i < numValues.length; i++) {
            varianceSum += Math.pow(numValues[i] - avg, 2);
          }
          const stdDev = Math.round(Math.sqrt(varianceSum / numValues.length) * 100) / 100;

          // Quartiles
          const q25 = numValues[Math.floor(numValues.length * 0.25)];
          const q75 = numValues[Math.floor(numValues.length * 0.75)];

          profile.min = min;
          profile.max = max;
          profile.average = avg;
          profile.median = median;
          profile.standardDeviation = stdDev;
          profile.zeroCount = zeroCount;
          profile.negativeCount = negativeCount;
          profile.numericDistribution = {
            min,
            q25,
            median,
            q75,
            max,
            avg,
            zeroCount
          };
        }
      } else if (col.dataType === 'date' || col.dataType === 'timestamp') {
        const dateStrings = nonNulls.map(String).filter(s => !isNaN(Date.parse(s)));
        if (dateStrings.length > 0) {
          dateStrings.sort();
          profile.earliestDate = dateStrings[0];
          profile.latestDate = dateStrings[dateStrings.length - 1];
          profile.min = dateStrings[0];
          profile.max = dateStrings[dateStrings.length - 1];
        }
      } else {
        // Text profiling
        let minLen = Infinity;
        let maxLen = 0;
        for (let i = 0; i < nonNulls.length; i++) {
          const s = String(nonNulls[i]);
          if (s.length < minLen) minLen = s.length;
          if (s.length > maxLen) maxLen = s.length;
        }
        profile.shortestLength = minLen === Infinity ? 0 : minLen;
        profile.longestLength = maxLen;
      }

      columnProfiles[colName] = profile;
    }

    return {
      datasetId,
      datasetName,
      totalRows,
      totalColumns,
      profiledAt: new Date().toISOString(),
      columns: columnProfiles,
      rowsAnalyzed: sampleSize,
      rowsSampled: isSampled ? sampleSize : totalRows,
      isSampled,
      samplePercentage,
      analysisMode
    };
  }
}
