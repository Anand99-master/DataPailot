import { ColumnMetadata, ColumnProfile, DataProfile } from '../../src/types/import';

export class DataProfiler {
  /**
   * Generates a comprehensive statistical and structural profile of an imported dataset
   */
  public static profile(
    datasetId: string,
    datasetName: string,
    columns: ColumnMetadata[],
    rows: Record<string, unknown>[],
    maxRowsToProfile = 5000
  ): DataProfile {
    const totalRows = rows.length;
    const totalColumns = columns.length;
    const sampledRows = rows.slice(0, maxRowsToProfile);
    const sampleSize = sampledRows.length;

    const columnProfiles: Record<string, ColumnProfile> = {};

    for (const col of columns) {
      const colName = col.name;
      const values = sampledRows.map(r => r[colName]);

      let nullCount = 0;
      const nonNulls: unknown[] = [];
      const distinctSet = new Set<unknown>();

      for (const v of values) {
        if (v === null || v === undefined || v === '') {
          nullCount++;
        } else {
          nonNulls.push(v);
          distinctSet.add(v);
        }
      }

      // If we sampled, estimate total null count proportionally
      const estimatedNullCount = sampleSize > 0 && sampleSize < totalRows
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
        sampleValues
      };

      // Type-specific statistical analysis
      if (col.dataType === 'integer' || col.dataType === 'numeric') {
        const numValues: number[] = [];
        let sum = 0;
        let zeroCount = 0;

        for (const v of nonNulls) {
          const num = typeof v === 'number' ? v : Number(v);
          if (!isNaN(num) && isFinite(num)) {
            numValues.push(num);
            sum += num;
            if (num === 0) zeroCount++;
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
          for (const n of numValues) {
            varianceSum += Math.pow(n - avg, 2);
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
        const strValues = nonNulls.map(String);
        if (strValues.length > 0) {
          let minLen = Infinity;
          let maxLen = 0;
          for (const s of strValues) {
            if (s.length < minLen) minLen = s.length;
            if (s.length > maxLen) maxLen = s.length;
          }
          profile.shortestLength = minLen === Infinity ? 0 : minLen;
          profile.longestLength = maxLen;
        }
      }

      columnProfiles[colName] = profile;
    }

    return {
      datasetId,
      datasetName,
      totalRows,
      totalColumns,
      profiledAt: new Date().toISOString(),
      columns: columnProfiles
    };
  }
}
