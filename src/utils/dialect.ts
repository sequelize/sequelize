import { randomUUID } from 'crypto';
import isPlainObject from 'lodash/isPlainObject';
import { v1 as uuidv1 } from 'uuid';
import type { AbstractDialect } from '../dialects/abstract';
import * as DataTypes from '../dialects/abstract/data-types.js';

export function now(dialect: AbstractDialect): Date {
  const d = new Date();
  if (!dialect.supports.milliseconds) {
    d.setMilliseconds(0);
  }

  return d;
}

export function toDefaultValue(value: unknown, dialect: AbstractDialect): unknown {
  if (typeof value === 'function') {
    const tmp = value();
    if (tmp instanceof DataTypes.AbstractDataType) {
      return tmp.toSql({ dialect });
    }

    return tmp;
  }

  if (value instanceof DataTypes.UUIDV1) {
    return uuidv1();
  }

  if (value instanceof DataTypes.UUIDV4) {
    return randomUUID();
  }

  if (value instanceof DataTypes.NOW) {
    return now(dialect);
  }

  if (Array.isArray(value)) {
    return [...value];
  }

  if (isPlainObject(value)) {
    return { ...(value as object) };
  }

  return value;
}

// Note: Use the `quoteIdentifier()` and `escape()` methods on the
// `QueryInterface` instead for more portable code.
export const TICK_CHAR = '`';

export function addTicks(s: string, tickChar: string = TICK_CHAR): string {
  return tickChar + removeTicks(s, tickChar) + tickChar;
}

export function removeTicks(s: string, tickChar: string = TICK_CHAR): string {
  return s.replace(new RegExp(tickChar, 'g'), '');
}
