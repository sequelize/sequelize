import isPlainObject from 'lodash/isPlainObject';
// eslint-disable-next-line import/order -- caused by temporarily mixing require with import
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid';

const DataTypes = require('../data-types');

const dialectsSupportingMilliseconds = new Set([
  'mariadb',
  'mysql',
  'postgres',
  'yugabyte',
  'sqlite',
  'mssql',
  'db2',
  'ibmi',
]);

// TODO: instead of receiving a dialect *name* here, require the actual AbstractDialect subclass
//  and add a flag on AbstractDialect.supports to determine if the date should include milliseconds.
export function now(dialect: string): Date {
  const d = new Date();
  if (!dialectsSupportingMilliseconds.has(dialect)) {
    d.setMilliseconds(0);
  }

  return d;
}

export function toDefaultValue(value: unknown, dialect: string): unknown {
  if (typeof value === 'function') {
    const tmp = value();
    if (tmp instanceof DataTypes.ABSTRACT) {
      return tmp.toSql();
    }

    return tmp;
  }

  if (value instanceof DataTypes.UUIDV1) {
    return uuidv1();
  }

  if (value instanceof DataTypes.UUIDV4) {
    return uuidv4();
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
