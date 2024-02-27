import { literal } from '../../expression-builders/literal';
import type { ColumnDescription } from '../abstract/query-interface.types';

const NUMBER_TYPES = ['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'FLOAT', 'DOUBLE'];

export function parseDefaultValue(
  rawDefaultValue: string | null,
  field: Omit<ColumnDescription, 'defaultValue'>,
  extra: string,
): unknown {
  if (extra?.includes('DEFAULT_GENERATED')) {
    if (rawDefaultValue) {
      return literal(rawDefaultValue);
    }

    return undefined;
  }

  if (extra?.includes('AUTO_INCREMENT')) {
    return undefined;
  }

  if (rawDefaultValue === null) {
    return null;
  }

  if (
    NUMBER_TYPES.includes(field.type) &&
    rawDefaultValue &&
    !Number.isNaN(Number(rawDefaultValue))
  ) {
    return Number(rawDefaultValue);
  }

  return rawDefaultValue;
}
