import _ from 'lodash';
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import { DataTypes } from '../..';

const dialects = new Set([
  'mariadb',
  'mysql',
  'postgres',
  'sqlite',
  'mssql',
  'db2'
]);

export function now(dialect: string) {
  const d = new Date();
  if (!dialects.has(dialect)) {
    d.setMilliseconds(0);
  }
  return d;
}

export function toDefaultValue(value: any, dialect: string) {
  if (typeof value === 'function') {
    const tmp = value();
    if (tmp instanceof DataTypes.ABSTRACT) {
      // TODO(sdepold): fix me :)
      // @ts-expect-error
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
    return value.slice();
  }
  if (_.isPlainObject(value)) {
    return { ...value };
  }
  return value;
}

export const TICK_CHAR = '`';

export function addTicks(s: string, tickChar: string = TICK_CHAR) {
  return tickChar + removeTicks(s, tickChar) + tickChar;
}

export function removeTicks(s: string, tickChar: string = TICK_CHAR) {
  return s.replace(new RegExp(tickChar, 'g'), '');
}
