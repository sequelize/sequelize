import { literal } from '../../expression-builders/literal';
import type { ColumnDescription } from '../abstract/query-interface.types';

export function parseDefaultValue(
  rawDefaultValue: string | null,
  field: Omit<ColumnDescription, 'defaultValue'>,
): unknown {
  if (rawDefaultValue === null && !field.allowNull) {
    return undefined;
  }

  if (rawDefaultValue === null || rawDefaultValue.startsWith('NULL::')) {
    return null;
  }

  if (['true', 'false'].includes(rawDefaultValue) && field.type === 'BOOLEAN') {
    return rawDefaultValue === 'true';
  }

  if (field.type !== 'NUMERIC') {
    if (rawDefaultValue && !Number.isNaN(Number(rawDefaultValue))) {
      return Number(rawDefaultValue);
    }

    if (rawDefaultValue.endsWith('::numeric') || rawDefaultValue.endsWith('::integer')) {
      const unQuote = rawDefaultValue.replace(/^'/, '').replace(/'?::.*$/, '');

      return Number(unQuote);
    }
  } else if (!rawDefaultValue.startsWith("'")) {
    return rawDefaultValue;
  }

  if (
    (field.type === 'JSON' && rawDefaultValue.endsWith('::json')) ||
    (field.type === 'JSONB' && rawDefaultValue.endsWith('::jsonb'))
  ) {
    const json = rawDefaultValue
      .replace(/^'/, '')
      .replace(/'?::jsonb?$/, '')
      .replaceAll("''", "'");

    return JSON.parse(json);
  }

  if (rawDefaultValue.startsWith("'")) {
    return parseStringValue(rawDefaultValue);
  }

  return literal(rawDefaultValue);
}

function parseStringValue(rawDefaultValue: string): string | undefined {
  let buffer = '';

  for (let i = 1; i < rawDefaultValue.length; i += 1) {
    const char = rawDefaultValue[i];

    if (char === "'") {
      if (rawDefaultValue[i + 1] === "'") {
        i += 1;
      } else {
        return buffer;
      }
    }

    buffer += char;
  }

  // Unable to parse string, return undefined
  return undefined;
}
