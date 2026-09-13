import { ColumnMetadata } from '../types/import';
import {
  TransformStep,
  PipelineValidationResult,
  StepValidationResult,
  DatasetCompatibilityResult,
  SavedPipeline
} from '../types/cleaning';
import { ExpressionEngine } from './expressionEngine';

export class PipelineValidator {
  /**
   * Validates an entire pipeline of steps against a starting set of columns,
   * simulating schema evolution step by step to catch missing/dropped columns or duplicate names.
   */
  public static validatePipeline(
    initialColumns: ColumnMetadata[],
    steps: TransformStep[]
  ): PipelineValidationResult {
    const stepValidations: StepValidationResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Current working column schema as steps progress
    let currentCols = new Map<string, ColumnMetadata>();
    for (const c of initialColumns) {
      currentCols.set(c.name, { ...c });
    }

    // Track column lifecycle: creation/rename/removal step numbers for diagnostic messages
    const colHistory = new Map<string, { action: 'created' | 'removed' | 'renamed'; stepIndex: number; oldName?: string }>();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepNumber = i + 1;

      if (!step.enabled) {
        stepValidations.push({
          stepId: step.id,
          status: 'valid',
          message: 'Step is disabled and will be skipped during execution.'
        });
        continue;
      }

      const val = this.validateStep(step, currentCols, colHistory, stepNumber);
      stepValidations.push(val);

      if (val.status === 'invalid') {
        errors.push(`Step ${stepNumber} (${step.type}): ${val.message}`);
      } else if (val.status === 'warning') {
        warnings.push(`Step ${stepNumber} (${step.type}): ${val.message}`);
      }

      // If valid or warning, update working schema to reflect this step's output
      if (val.status !== 'invalid') {
        currentCols = this.simulateSchemaChange(step, currentCols, colHistory, stepNumber);
      }
    }

    const isValid = !stepValidations.some(s => s.status === 'invalid');

    return {
      isValid,
      stepValidations,
      errors,
      warnings
    };
  }

  /**
   * Validates a single step against the current active column schema
   */
  public static validateStep(
    step: TransformStep,
    currentCols: Map<string, ColumnMetadata>,
    colHistory: Map<string, { action: 'created' | 'removed' | 'renamed'; stepIndex: number; oldName?: string }>,
    stepNumber: number
  ): StepValidationResult {
    const params = step.params || {};

    // Helper to format missing column reason
    const getMissingReason = (colName: string): string => {
      const hist = colHistory.get(colName);
      if (hist) {
        if (hist.action === 'removed') {
          return `Column "${colName}" no longer exists because Step ${hist.stepIndex} removed it.`;
        }
        if (hist.action === 'renamed') {
          return `Column "${colName}" was renamed in Step ${hist.stepIndex}.`;
        }
      }
      return `Column "${colName}" does not exist in the dataset.`;
    };

    switch (step.type) {
      case 'REMOVE_MISSING': {
        const cols: string[] = params.columns || [];
        for (const c of cols) {
          if (!currentCols.has(c)) {
            return { stepId: step.id, status: 'invalid', message: getMissingReason(c) };
          }
        }
        return { stepId: step.id, status: 'valid', message: 'Valid missing value removal configuration.' };
      }

      case 'FILL_MISSING': {
        const col = params.column;
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Target column is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };

        const strategy = params.strategy;
        const colMeta = currentCols.get(col);
        if (['mean', 'median'].includes(strategy) && colMeta && !['integer', 'numeric'].includes(colMeta.dataType)) {
          return {
            stepId: step.id,
            status: 'warning',
            message: `Strategy "${strategy}" is usually applied to numeric columns, but "${col}" is ${colMeta.dataType}.`
          };
        }
        return { stepId: step.id, status: 'valid', message: `Fill missing values in "${col}" using ${strategy}.` };
      }

      case 'REMOVE_DUPLICATES': {
        const cols: string[] = params.columns || [];
        for (const c of cols) {
          if (!currentCols.has(c)) {
            return { stepId: step.id, status: 'invalid', message: getMissingReason(c) };
          }
        }
        return { stepId: step.id, status: 'valid', message: 'Valid duplicate removal configuration.' };
      }

      case 'CONVERT_TYPE': {
        const col = params.column;
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Target column is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };
        if (!params.targetType) return { stepId: step.id, status: 'invalid', message: 'Target data type is required.' };
        return { stepId: step.id, status: 'valid', message: `Convert "${col}" to ${params.targetType}.` };
      }

      case 'STANDARDIZE_DATE': {
        const col = params.column;
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Target column is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };
        if (!params.targetFormat) return { stepId: step.id, status: 'invalid', message: 'Target date format is required.' };
        return { stepId: step.id, status: 'valid', message: `Standardize date in "${col}" to ${params.targetFormat}.` };
      }

      case 'TEXT_CLEAN': {
        const col = params.column;
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Target column is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };
        return { stepId: step.id, status: 'valid', message: `Clean text in "${col}".` };
      }

      case 'NUMERIC_CLEAN': {
        const col = params.column;
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Target column is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };
        return { stepId: step.id, status: 'valid', message: `Clean numeric formatting in "${col}".` };
      }

      case 'MAP_VALUES': {
        const col = params.column;
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Target column is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };
        if (!Array.isArray(params.mappings) || params.mappings.length === 0) {
          return { stepId: step.id, status: 'warning', message: 'No value mappings configured.' };
        }
        return { stepId: step.id, status: 'valid', message: `Map values for "${col}".` };
      }

      case 'HANDLE_OUTLIERS': {
        const col = params.column;
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Target column is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };
        const colMeta = currentCols.get(col);
        if (colMeta && !['integer', 'numeric'].includes(colMeta.dataType)) {
          return {
            stepId: step.id,
            status: 'warning',
            message: `Outlier detection is intended for numeric columns, but "${col}" is ${colMeta.dataType}.`
          };
        }
        return { stepId: step.id, status: 'valid', message: `Handle outliers in "${col}".` };
      }

      case 'RENAME_COLUMN': {
        const oldName = params.oldName;
        const newName = params.newName?.trim();
        if (!oldName) return { stepId: step.id, status: 'invalid', message: 'Source column name is required.' };
        if (!newName) return { stepId: step.id, status: 'invalid', message: 'New column name is required.' };
        if (!currentCols.has(oldName)) return { stepId: step.id, status: 'invalid', message: getMissingReason(oldName) };
        if (oldName !== newName && currentCols.has(newName)) {
          return {
            stepId: step.id,
            status: 'warning',
            message: `Target column name "${newName}" already exists and will be overwritten.`
          };
        }
        return { stepId: step.id, status: 'valid', message: `Rename "${oldName}" to "${newName}".` };
      }

      case 'DROP_COLUMN': {
        const cols: string[] = params.columns || [];
        if (cols.length === 0) {
          return { stepId: step.id, status: 'warning', message: 'No columns specified to drop.' };
        }
        for (const c of cols) {
          if (!currentCols.has(c)) {
            return { stepId: step.id, status: 'invalid', message: getMissingReason(c) };
          }
        }
        if (cols.length >= currentCols.size) {
          return { stepId: step.id, status: 'invalid', message: 'Cannot drop all columns in the dataset.' };
        }
        return { stepId: step.id, status: 'valid', message: `Drop ${cols.length} column(s): ${cols.join(', ')}.` };
      }

      case 'DUPLICATE_COLUMN': {
        const src = params.sourceColumn;
        const newCol = params.newColumnName?.trim();
        if (!src) return { stepId: step.id, status: 'invalid', message: 'Source column is required.' };
        if (!newCol) return { stepId: step.id, status: 'invalid', message: 'New column name is required.' };
        if (!currentCols.has(src)) return { stepId: step.id, status: 'invalid', message: getMissingReason(src) };
        if (currentCols.has(newCol)) {
          return {
            stepId: step.id,
            status: 'warning',
            message: `Column "${newCol}" already exists and will be overwritten.`
          };
        }
        return { stepId: step.id, status: 'valid', message: `Duplicate "${src}" into "${newCol}".` };
      }

      case 'REORDER_COLUMNS': {
        const order: string[] = params.orderedColumns || [];
        if (order.length === 0) {
          return { stepId: step.id, status: 'warning', message: 'No column order specified.' };
        }
        for (const c of order) {
          if (!currentCols.has(c)) {
            return { stepId: step.id, status: 'invalid', message: getMissingReason(c) };
          }
        }
        return { stepId: step.id, status: 'valid', message: 'Reorder dataset columns.' };
      }

      case 'SPLIT_COLUMN': {
        const col = params.column;
        const delim = params.delimiter;
        const newNames: string[] = params.newColumnNames || [];
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Source column is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };
        if (delim === undefined || delim === null) return { stepId: step.id, status: 'invalid', message: 'Delimiter is required.' };
        if (newNames.length === 0) return { stepId: step.id, status: 'invalid', message: 'At least one new column name is required.' };
        return { stepId: step.id, status: 'valid', message: `Split "${col}" into ${newNames.length} columns.` };
      }

      case 'MERGE_COLUMNS': {
        const cols: string[] = params.columns || [];
        const newName = params.newColumnName?.trim();
        if (cols.length < 2) return { stepId: step.id, status: 'invalid', message: 'At least 2 columns are required to merge.' };
        for (const c of cols) {
          if (!currentCols.has(c)) {
            return { stepId: step.id, status: 'invalid', message: getMissingReason(c) };
          }
        }
        if (!newName) return { stepId: step.id, status: 'invalid', message: 'New column name is required.' };
        return { stepId: step.id, status: 'valid', message: `Merge ${cols.length} columns into "${newName}".` };
      }

      case 'EXTRACT_TEXT': {
        const col = params.column;
        const newCol = params.newColumnName?.trim();
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Source column is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };
        if (!newCol && !params.replaceOriginal) return { stepId: step.id, status: 'invalid', message: 'Target column name is required.' };
        return { stepId: step.id, status: 'valid', message: `Extract text from "${col}".` };
      }

      case 'CALCULATED_COLUMN': {
        const newName = params.newColumnName?.trim();
        const expr = params.expression?.trim();
        if (!newName) return { stepId: step.id, status: 'invalid', message: 'New column name is required.' };
        if (!expr) return { stepId: step.id, status: 'invalid', message: 'Formula expression is required.' };

        const availableList = Array.from(currentCols.keys());
        const exprValidation = ExpressionEngine.validate(expr, availableList);
        if (!exprValidation.valid) {
          return {
            stepId: step.id,
            status: 'invalid',
            message: exprValidation.error || 'Invalid formula expression.'
          };
        }

        // Check if any referenced columns are missing
        for (const ref of exprValidation.referencedColumns) {
          if (!currentCols.has(ref)) {
            return { stepId: step.id, status: 'invalid', message: getMissingReason(ref) };
          }
        }

        return { stepId: step.id, status: 'valid', message: `Calculate "${newName}" = ${expr}` };
      }

      case 'CONDITIONAL_COLUMN': {
        const newName = params.newColumnName?.trim();
        const rules = params.rules || [];
        if (!newName) return { stepId: step.id, status: 'invalid', message: 'New column name is required.' };
        if (rules.length === 0) return { stepId: step.id, status: 'invalid', message: 'At least one conditional rule is required.' };

        for (let rIdx = 0; rIdx < rules.length; rIdx++) {
          const rule = rules[rIdx];
          const conds = rule.conditions || [];
          if (conds.length === 0) {
            return { stepId: step.id, status: 'invalid', message: `Rule #${rIdx + 1} has no conditions defined.` };
          }
          for (const c of conds) {
            if (!c.column) return { stepId: step.id, status: 'invalid', message: `Condition in Rule #${rIdx + 1} missing column.` };
            if (!currentCols.has(c.column)) {
              return { stepId: step.id, status: 'invalid', message: getMissingReason(c.column) };
            }
          }
        }
        return { stepId: step.id, status: 'valid', message: `Create conditional column "${newName}".` };
      }

      case 'FILTER_ROWS': {
        const conds = params.conditions || [];
        if (conds.length === 0) return { stepId: step.id, status: 'warning', message: 'No filter conditions defined.' };
        for (const c of conds) {
          if (!c.column) return { stepId: step.id, status: 'invalid', message: 'Filter condition missing column.' };
          if (!currentCols.has(c.column)) {
            return { stepId: step.id, status: 'invalid', message: getMissingReason(c.column) };
          }
        }
        return { stepId: step.id, status: 'valid', message: `Filter rows (${params.action === 'keep' ? 'keep matching' : 'remove matching'}).` };
      }

      case 'SORT_ROWS': {
        const levels = params.levels || [];
        if (levels.length === 0) return { stepId: step.id, status: 'warning', message: 'No sort levels defined.' };
        for (const lvl of levels) {
          if (!lvl.column) return { stepId: step.id, status: 'invalid', message: 'Sort level missing column.' };
          if (!currentCols.has(lvl.column)) {
            return { stepId: step.id, status: 'invalid', message: getMissingReason(lvl.column) };
          }
        }
        return { stepId: step.id, status: 'valid', message: `Sort by ${levels.length} column(s).` };
      }

      case 'RANK_ROWS': {
        const measure = params.measureColumn;
        const target = params.targetColumnName?.trim();
        if (!measure) return { stepId: step.id, status: 'invalid', message: 'Measure column is required.' };
        if (!target) return { stepId: step.id, status: 'invalid', message: 'Target rank column name is required.' };
        if (!currentCols.has(measure)) return { stepId: step.id, status: 'invalid', message: getMissingReason(measure) };
        if (params.partitionBy && params.partitionBy !== 'none' && !currentCols.has(params.partitionBy)) {
          return { stepId: step.id, status: 'invalid', message: getMissingReason(params.partitionBy) };
        }
        return { stepId: step.id, status: 'valid', message: `Rank by "${measure}" into "${target}".` };
      }

      case 'DATE_EXTRACT': {
        const col = params.column;
        const target = params.targetColumnName?.trim();
        if (!col) return { stepId: step.id, status: 'invalid', message: 'Source date column is required.' };
        if (!target) return { stepId: step.id, status: 'invalid', message: 'Target column name is required.' };
        if (!currentCols.has(col)) return { stepId: step.id, status: 'invalid', message: getMissingReason(col) };
        if (!params.part) return { stepId: step.id, status: 'invalid', message: 'Date part is required.' };
        return { stepId: step.id, status: 'valid', message: `Extract ${params.part} from "${col}" into "${target}".` };
      }

      case 'DATE_DIFF': {
        const start = params.startDateColumn;
        const end = params.endDateColumn;
        const target = params.targetColumnName?.trim();
        if (!start || !end) return { stepId: step.id, status: 'invalid', message: 'Start and end date columns are required.' };
        if (!target) return { stepId: step.id, status: 'invalid', message: 'Target duration column name is required.' };
        if (!currentCols.has(start)) return { stepId: step.id, status: 'invalid', message: getMissingReason(start) };
        if (!currentCols.has(end)) return { stepId: step.id, status: 'invalid', message: getMissingReason(end) };
        return { stepId: step.id, status: 'valid', message: `Calculate difference between "${start}" and "${end}".` };
      }

      case 'PIVOT_TABLE': {
        const rowCols: string[] = params.rowColumns || [];
        const pivotCol = params.pivotColumn;
        const valCol = params.valueColumn;
        if (rowCols.length === 0) return { stepId: step.id, status: 'invalid', message: 'At least one row grouping column is required.' };
        if (!pivotCol) return { stepId: step.id, status: 'invalid', message: 'Pivot category column is required.' };
        if (!valCol) return { stepId: step.id, status: 'invalid', message: 'Value aggregation column is required.' };
        for (const c of rowCols) {
          if (!currentCols.has(c)) return { stepId: step.id, status: 'invalid', message: getMissingReason(c) };
        }
        if (!currentCols.has(pivotCol)) return { stepId: step.id, status: 'invalid', message: getMissingReason(pivotCol) };
        if (!currentCols.has(valCol)) return { stepId: step.id, status: 'invalid', message: getMissingReason(valCol) };
        return { stepId: step.id, status: 'valid', message: `Pivot by "${pivotCol}" aggregating "${valCol}".` };
      }

      case 'UNPIVOT_TABLE': {
        const idCols: string[] = params.idColumns || [];
        const valCols: string[] = params.valueColumns || [];
        const attrCol = params.attributeColumnName?.trim();
        const valCol = params.valueColumnName?.trim();
        if (idCols.length === 0) return { stepId: step.id, status: 'invalid', message: 'At least one ID column is required.' };
        if (valCols.length === 0) return { stepId: step.id, status: 'invalid', message: 'At least one column to unpivot is required.' };
        if (!attrCol) return { stepId: step.id, status: 'invalid', message: 'Attribute column name is required.' };
        if (!valCol) return { stepId: step.id, status: 'invalid', message: 'Value column name is required.' };
        for (const c of idCols) {
          if (!currentCols.has(c)) return { stepId: step.id, status: 'invalid', message: getMissingReason(c) };
        }
        for (const c of valCols) {
          if (!currentCols.has(c)) return { stepId: step.id, status: 'invalid', message: getMissingReason(c) };
        }
        return { stepId: step.id, status: 'valid', message: `Unpivot ${valCols.length} columns into attribute/value pairs.` };
      }

      default:
        return { stepId: step.id, status: 'valid', message: 'Valid transformation step.' };
    }
  }

  /**
   * Simulates how a step alters the schema for downstream steps
   */
  private static simulateSchemaChange(
    step: TransformStep,
    currentCols: Map<string, ColumnMetadata>,
    colHistory: Map<string, { action: 'created' | 'removed' | 'renamed'; stepIndex: number; oldName?: string }>,
    stepNumber: number
  ): Map<string, ColumnMetadata> {
    const next = new Map<string, ColumnMetadata>(currentCols);
    const params = step.params || {};

    switch (step.type) {
      case 'CONVERT_TYPE': {
        const col = params.column;
        if (next.has(col)) {
          const orig = next.get(col)!;
          next.set(col, { ...orig, dataType: params.targetType || orig.dataType });
        }
        break;
      }
      case 'RENAME_COLUMN': {
        const { oldName, newName } = params;
        if (oldName && newName && next.has(oldName)) {
          const orig = next.get(oldName)!;
          next.delete(oldName);
          next.set(newName, { ...orig, name: newName });
          colHistory.set(oldName, { action: 'renamed', stepIndex: stepNumber, oldName });
          colHistory.set(newName, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'DROP_COLUMN': {
        const cols: string[] = params.columns || [];
        for (const c of cols) {
          next.delete(c);
          colHistory.set(c, { action: 'removed', stepIndex: stepNumber });
        }
        break;
      }
      case 'DUPLICATE_COLUMN': {
        const { sourceColumn, newColumnName } = params;
        if (sourceColumn && newColumnName && next.has(sourceColumn)) {
          const orig = next.get(sourceColumn)!;
          next.set(newColumnName, { ...orig, name: newColumnName });
          colHistory.set(newColumnName, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'SPLIT_COLUMN': {
        const { column, newColumnNames = [], keepOriginal } = params;
        if (!keepOriginal && column) {
          next.delete(column);
          colHistory.set(column, { action: 'removed', stepIndex: stepNumber });
        }
        for (const name of newColumnNames) {
          next.set(name, { name, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
          colHistory.set(name, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'MERGE_COLUMNS': {
        const { columns = [], newColumnName, keepOriginal } = params;
        if (!keepOriginal) {
          for (const c of columns) {
            next.delete(c);
            colHistory.set(c, { action: 'removed', stepIndex: stepNumber });
          }
        }
        if (newColumnName) {
          next.set(newColumnName, { name: newColumnName, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
          colHistory.set(newColumnName, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'EXTRACT_TEXT': {
        const { newColumnName, replaceOriginal, column } = params;
        if (!replaceOriginal && newColumnName) {
          next.set(newColumnName, { name: newColumnName, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
          colHistory.set(newColumnName, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'CALCULATED_COLUMN': {
        const { newColumnName, resultType = 'numeric' } = params;
        if (newColumnName) {
          next.set(newColumnName, { name: newColumnName, dataType: resultType === 'numeric' ? 'numeric' : resultType === 'boolean' ? 'boolean' : 'text', isNullable: true, nullCount: 0, sampleValues: [] });
          colHistory.set(newColumnName, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'CONDITIONAL_COLUMN': {
        const { newColumnName } = params;
        if (newColumnName) {
          next.set(newColumnName, { name: newColumnName, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
          colHistory.set(newColumnName, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'RANK_ROWS': {
        const { targetColumnName } = params;
        if (targetColumnName) {
          next.set(targetColumnName, { name: targetColumnName, dataType: 'integer', isNullable: true, nullCount: 0, sampleValues: [] });
          colHistory.set(targetColumnName, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'DATE_EXTRACT': {
        const { targetColumnName, part } = params;
        if (targetColumnName) {
          const isNumericPart = ['year', 'quarter', 'month_num', 'week', 'day', 'day_of_week'].includes(part);
          next.set(targetColumnName, { name: targetColumnName, dataType: isNumericPart ? 'integer' : 'text', isNullable: true, nullCount: 0, sampleValues: [] });
          colHistory.set(targetColumnName, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'DATE_DIFF': {
        const { targetColumnName } = params;
        if (targetColumnName) {
          next.set(targetColumnName, { name: targetColumnName, dataType: 'numeric', isNullable: true, nullCount: 0, sampleValues: [] });
          colHistory.set(targetColumnName, { action: 'created', stepIndex: stepNumber });
        }
        break;
      }
      case 'PIVOT_TABLE': {
        // Pivot produces a transformed schema with rowColumns + dynamically pivoted categories
        // Keep row columns and assume placeholder new columns
        const rowCols: string[] = params.rowColumns || [];
        const nextMap = new Map<string, ColumnMetadata>();
        for (const r of rowCols) {
          if (next.has(r)) nextMap.set(r, next.get(r)!);
        }
        return nextMap;
      }
      case 'UNPIVOT_TABLE': {
        const idCols: string[] = params.idColumns || [];
        const attrCol = params.attributeColumnName || 'Attribute';
        const valCol = params.valueColumnName || 'Value';
        const nextMap = new Map<string, ColumnMetadata>();
        for (const id of idCols) {
          if (next.has(id)) nextMap.set(id, next.get(id)!);
        }
        nextMap.set(attrCol, { name: attrCol, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
        nextMap.set(valCol, { name: valCol, dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] });
        return nextMap;
      }
    }

    return next;
  }

  /**
   * Extracts all column names that the pipeline references as input requirements
   */
  public static extractRequiredColumns(steps: TransformStep[]): string[] {
    const required = new Set<string>();

    for (const step of steps) {
      if (!step.enabled) continue;
      const p = step.params || {};

      if (step.column) required.add(step.column);
      if (p.column) required.add(p.column);
      if (p.oldName) required.add(p.oldName);
      if (p.sourceColumn) required.add(p.sourceColumn);
      if (p.startDateColumn) required.add(p.startDateColumn);
      if (p.endDateColumn) required.add(p.endDateColumn);
      if (p.measureColumn) required.add(p.measureColumn);
      if (p.partitionBy && p.partitionBy !== 'none') required.add(p.partitionBy);
      if (p.pivotColumn) required.add(p.pivotColumn);
      if (p.valueColumn) required.add(p.valueColumn);

      if (Array.isArray(p.columns)) {
        p.columns.forEach((c: string) => required.add(c));
      }
      if (Array.isArray(p.rowColumns)) {
        p.rowColumns.forEach((c: string) => required.add(c));
      }
      if (Array.isArray(p.idColumns)) {
        p.idColumns.forEach((c: string) => required.add(c));
      }
      if (Array.isArray(p.valueColumns)) {
        p.valueColumns.forEach((c: string) => required.add(c));
      }

      if (p.expression) {
        const tokens = ExpressionEngine.tokenize(p.expression);
        for (const t of tokens) {
          if (t.type === 'IDENTIFIER') required.add(t.value);
        }
      }

      if (Array.isArray(p.rules)) {
        for (const r of p.rules) {
          if (Array.isArray(r.conditions)) {
            r.conditions.forEach((c: any) => { if (c.column) required.add(c.column); });
          }
        }
      }

      if (Array.isArray(p.conditions)) {
        p.conditions.forEach((c: any) => { if (c.column) required.add(c.column); });
      }

      if (Array.isArray(p.levels)) {
        p.levels.forEach((lvl: any) => { if (lvl.column) required.add(lvl.column); });
      }
    }

    return Array.from(required);
  }

  /**
   * Compares a pipeline against a target dataset to verify compatibility
   * and suggests fuzzy candidate matches for missing columns.
   */
  public static checkCompatibility(
    pipeline: SavedPipeline | { steps: TransformStep[]; requiredColumns?: string[] },
    targetDatasetColumns: ColumnMetadata[]
  ): DatasetCompatibilityResult {
    const targetColNames = targetDatasetColumns.map(c => c.name);
    const targetColSet = new Set(targetColNames);
    const targetColLowerMap = new Map<string, string>();
    for (const name of targetColNames) {
      targetColLowerMap.set(name.toLowerCase().replace(/[^a-z0-9]/g, ''), name);
    }

    const requiredCols = pipeline.requiredColumns && pipeline.requiredColumns.length > 0
      ? pipeline.requiredColumns
      : this.extractRequiredColumns(pipeline.steps);

    const missingColumns: string[] = [];
    const matchedColumns: string[] = [];
    const possibleMatches: { missing: string; candidate: string }[] = [];
    const warnings: string[] = [];

    // Common synonyms
    const synonyms: Record<string, string[]> = {
      sales: ['revenue', 'amount', 'total', 'price', 'income'],
      revenue: ['sales', 'amount', 'total', 'turnover'],
      customer_name: ['customer', 'name', 'client', 'contact_name', 'full_name'],
      full_name: ['name', 'customer_name', 'client_name'],
      order_date: ['date', 'created_at', 'timestamp', 'transaction_date'],
      date: ['order_date', 'created_at', 'timestamp'],
      cost: ['expense', 'spending', 'price'],
      profit: ['net_income', 'margin', 'gain']
    };

    for (const req of requiredCols) {
      if (targetColSet.has(req)) {
        matchedColumns.push(req);
      } else {
        missingColumns.push(req);

        // Try fuzzy case-insensitive normalized match
        const norm = req.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (targetColLowerMap.has(norm)) {
          possibleMatches.push({
            missing: req,
            candidate: targetColLowerMap.get(norm)!
          });
          continue;
        }

        // Try synonym matching
        const reqLower = req.toLowerCase();
        let foundSynonym = false;
        for (const [key, list] of Object.entries(synonyms)) {
          if (reqLower === key || reqLower.includes(key)) {
            for (const syn of list) {
              const match = targetColNames.find(tc => tc.toLowerCase().includes(syn));
              if (match) {
                possibleMatches.push({ missing: req, candidate: match });
                foundSynonym = true;
                break;
              }
            }
          }
          if (foundSynonym) break;
        }
      }
    }

    let status: 'fully_compatible' | 'partially_compatible' | 'incompatible' = 'fully_compatible';
    if (missingColumns.length > 0) {
      if (matchedColumns.length > 0 || possibleMatches.length > 0) {
        status = 'partially_compatible';
        warnings.push(`Missing ${missingColumns.length} required column(s): ${missingColumns.join(', ')}.`);
      } else {
        status = 'incompatible';
        warnings.push('None of the required columns were found in the target dataset.');
      }
    }

    return {
      isCompatible: missingColumns.length === 0,
      status,
      missingColumns,
      matchedColumns,
      typeMismatches: [],
      possibleMatches,
      warnings
    };
  }
}
