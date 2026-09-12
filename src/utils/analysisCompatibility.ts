import { TableColumnInfo } from '../types/database';

export interface ColumnClassification {
  numericColumns: TableColumnInfo[];
  dateColumns: TableColumnInfo[];
  stringColumns: TableColumnInfo[];
  idColumns: TableColumnInfo[];
  allColumns: TableColumnInfo[];
}

export function classifyColumns(columns: TableColumnInfo[]): ColumnClassification {
  const numericTypes = new Set([
    'int', 'int2', 'int4', 'int8', 'integer', 'bigint', 'smallint',
    'decimal', 'numeric', 'real', 'double precision', 'float', 'float4', 'float8', 'money'
  ]);

  const dateTypes = new Set([
    'date', 'timestamp', 'timestamptz', 'timestamp without time zone',
    'timestamp with time zone', 'time', 'timetz'
  ]);

  const stringTypes = new Set([
    'varchar', 'character varying', 'text', 'char', 'character', 'citext', 'string'
  ]);

  const numericColumns: TableColumnInfo[] = [];
  const dateColumns: TableColumnInfo[] = [];
  const stringColumns: TableColumnInfo[] = [];
  const idColumns: TableColumnInfo[] = [];

  for (const col of columns) {
    const dt = col.dataType.toLowerCase();
    const name = col.name.toLowerCase();

    const isNum = numericTypes.has(dt) || dt.includes('int') || dt.includes('numeric') || dt.includes('decimal') || dt.includes('double') || dt.includes('real');
    const isDt = dateTypes.has(dt) || dt.includes('date') || dt.includes('timestamp');
    const isStr = stringTypes.has(dt) || dt.includes('char') || dt.includes('text');

    if (isNum) numericColumns.push(col);
    if (isDt) dateColumns.push(col);
    if (isStr) stringColumns.push(col);

    if (
      col.isPrimaryKey ||
      col.isForeignKey ||
      name.endsWith('_id') ||
      name.startsWith('id_') ||
      name === 'id' ||
      dt.includes('uuid')
    ) {
      idColumns.push(col);
    }
  }

  return {
    numericColumns,
    dateColumns,
    stringColumns,
    idColumns,
    allColumns: columns
  };
}

export interface CompatibilityCheckResult {
  isCompatible: boolean;
  missingMessage?: string;
  suggestions: Record<string, string>;
}

/**
 * Checks compatibility for specific analysis operations and generates smart suggestions
 */
export class AnalysisCompatibility {
  public static checkDateAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const { dateColumns, numericColumns } = classifyColumns(columns);

    if (dateColumns.length === 0) {
      return {
        isCompatible: false,
        missingMessage: 'Requires at least one DATE or TIMESTAMP column in this table.',
        suggestions: {}
      };
    }

    const suggestedDate = dateColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('created') || n.includes('order') || n.includes('date') || n.includes('time');
    }) || dateColumns[0];

    const suggestedMeasure = numericColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('amount') || n.includes('total') || n.includes('revenue') || n.includes('sales') || n.includes('price');
    }) || numericColumns[0];

    return {
      isCompatible: true,
      suggestions: {
        dateColumn: suggestedDate ? `${suggestedDate.name} (Suggested)` : '',
        measureColumn: suggestedMeasure ? `${suggestedMeasure.name} (Suggested)` : '*'
      }
    };
  }

  public static checkCustomerAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const { idColumns, numericColumns, dateColumns } = classifyColumns(columns);

    const customerIdCol = idColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('customer') || n.includes('user') || n.includes('client') || n.includes('account');
    }) || idColumns[0];

    if (!customerIdCol && columns.length > 0) {
      // Look for any id column
      const fallbackId = columns.find(c => c.name.toLowerCase().includes('id'));
      if (!fallbackId) {
        return {
          isCompatible: false,
          missingMessage: 'No Customer or User Identifier column (e.g. customer_id, user_id, id) found in this table.',
          suggestions: {}
        };
      }
    }

    const suggestedAmount = numericColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('amount') || n.includes('total') || n.includes('revenue') || n.includes('price');
    });

    const suggestedDate = dateColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('order') || n.includes('created') || n.includes('date');
    }) || dateColumns[0];

    return {
      isCompatible: true,
      suggestions: {
        customerId: customerIdCol?.name || 'id',
        amountColumn: suggestedAmount?.name || '',
        dateColumn: suggestedDate?.name || ''
      }
    };
  }

  public static checkSalesAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const { numericColumns, dateColumns, stringColumns } = classifyColumns(columns);

    if (numericColumns.length === 0) {
      return {
        isCompatible: false,
        missingMessage: 'No NUMERIC column (amount, revenue, quantity, price) found in this table for sales calculations.',
        suggestions: {}
      };
    }

    const suggestedRevenue = numericColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('revenue') || n.includes('amount') || n.includes('total') || n.includes('sales') || n.includes('price');
    }) || numericColumns[0];

    const suggestedQty = numericColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('qty') || n.includes('quantity') || n.includes('units') || n.includes('count');
    });

    const suggestedDate = dateColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('date') || n.includes('created') || n.includes('order');
    }) || dateColumns[0];

    const suggestedCategory = stringColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('product') || n.includes('category') || n.includes('region') || n.includes('country') || n.includes('status');
    }) || stringColumns[0];

    return {
      isCompatible: true,
      suggestions: {
        revenueColumn: suggestedRevenue ? suggestedRevenue.name : '',
        quantityColumn: suggestedQty ? suggestedQty.name : '',
        dateColumn: suggestedDate ? suggestedDate.name : '',
        categoryColumn: suggestedCategory ? suggestedCategory.name : ''
      }
    };
  }

  public static checkProductAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const { numericColumns, stringColumns, idColumns } = classifyColumns(columns);

    const productIdentifier = stringColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('product') || n.includes('item') || n.includes('sku') || n.includes('name');
    }) || idColumns.find(c => c.name.toLowerCase().includes('product')) || stringColumns[0];

    if (!productIdentifier) {
      return {
        isCompatible: false,
        missingMessage: 'Requires a product name, title, SKU, or category column in this table.',
        suggestions: {}
      };
    }

    const suggestedMeasure = numericColumns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('amount') || n.includes('revenue') || n.includes('price') || n.includes('sales') || n.includes('quantity');
    }) || numericColumns[0];

    return {
      isCompatible: true,
      suggestions: {
        productColumn: productIdentifier.name,
        measureColumn: suggestedMeasure ? suggestedMeasure.name : ''
      }
    };
  }

  public static checkCohortAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const { idColumns, dateColumns } = classifyColumns(columns);

    if (idColumns.length === 0) {
      return {
        isCompatible: false,
        missingMessage: 'Cohort analysis requires a User/Customer Identifier column (e.g. user_id, customer_id, id).',
        suggestions: {}
      };
    }

    if (dateColumns.length < 1) {
      return {
        isCompatible: false,
        missingMessage: 'Cohort analysis requires at least one DATE or TIMESTAMP column (activity date or signup date).',
        suggestions: {}
      };
    }

    const userCol = idColumns.find(c => c.name.toLowerCase().includes('user') || c.name.toLowerCase().includes('customer')) || idColumns[0];
    const firstDateCol = dateColumns.find(c => c.name.toLowerCase().includes('created') || c.name.toLowerCase().includes('signup') || c.name.toLowerCase().includes('first')) || dateColumns[0];
    const activityDateCol = dateColumns.find(c => c.name.toLowerCase().includes('order') || c.name.toLowerCase().includes('activity') || c.name.toLowerCase().includes('date') && c.name !== firstDateCol?.name) || dateColumns[0];

    return {
      isCompatible: true,
      suggestions: {
        userIdColumn: userCol.name,
        firstActivityDateColumn: firstDateCol.name,
        activityDateColumn: activityDateCol.name
      }
    };
  }
}
