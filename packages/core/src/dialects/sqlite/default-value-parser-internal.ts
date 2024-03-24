import { literal } from '../../expression-builders/literal';
import type { ColumnDescription } from '../abstract/query-interface.types';

const NUMBER_TYPES = ['INTEGER', 'REAL'];

export function parseDefaultValue(
  rawDefaultValue: string | null,
  field: Omit<ColumnDescription, 'defaultValue'>,
): unknown {
  if (rawDefaultValue === null) {
    // Column schema omits any "DEFAULT ..."
    return undefined;
  } else if (rawDefaultValue === 'NULL') {
    // Column schema is a "DEFAULT NULL"
    return null;
  }

  if (NUMBER_TYPES.includes(field.type) && !Number.isNaN(Number(rawDefaultValue))) {
    return Number(rawDefaultValue);
  }

  if (rawDefaultValue?.startsWith("'") && rawDefaultValue.endsWith("'")) {
    return rawDefaultValue.slice(1, -1).replaceAll("''", "'");
  }

  return literal(rawDefaultValue);
}
