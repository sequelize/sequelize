import { literal } from '../../expression-builders/literal';
import type { ColumnDescription } from '../abstract/query-interface.types';

const NUMBER_TYPES = ['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'FLOAT', 'DOUBLE'];

export function parseDefaultValue(
  rawDefaultValue: string | null,
  field: Omit<ColumnDescription, 'defaultValue'>,
): unknown {
  if (field.autoIncrement || rawDefaultValue === null) {
    return undefined;
  }

  if (rawDefaultValue === 'NULL') {
    return null;
  }

  if (
    NUMBER_TYPES.some(type => field.type.startsWith(type)) &&
    rawDefaultValue &&
    !Number.isNaN(Number(rawDefaultValue))
  ) {
    return Number(rawDefaultValue);
  }

  if (field.type.startsWith('DECIMAL(')) {
    return rawDefaultValue;
  }

  if (rawDefaultValue.startsWith("'") && rawDefaultValue.endsWith("'")) {
    return rawDefaultValue.slice(1, -1).replaceAll("''", "'").replaceAll('\\\\', '\\');
  }

  if (!Number.isNaN(Number(rawDefaultValue))) {
    return rawDefaultValue;
  }

  return literal(rawDefaultValue);
}
