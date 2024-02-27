const NUMBER_TYPES = ['INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'FLOAT', 'DOUBLE'];

export function parseDefaultValue(
  rawDefaultValue: string | null,
  columnType: string,
  extra: string,
): unknown {
  if (rawDefaultValue === null) {
    return null;
  }

  if (extra?.includes('DEFAULT_GENERATED') || extra?.includes('AUTO_INCREMENT')) {
    return undefined;
  }

  if (
    NUMBER_TYPES.includes(columnType) &&
    rawDefaultValue &&
    !Number.isNaN(Number(rawDefaultValue))
  ) {
    return Number(rawDefaultValue);
  }

  return rawDefaultValue;
}
