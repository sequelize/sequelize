import { randomUUID } from 'node:crypto';
import NodeUtil from 'node:util';
import isPlainObject from 'lodash/isPlainObject';
import { v1 as uuidv1 } from 'uuid';
import * as DataTypes from '../dialects/abstract/data-types.js';
import { isString } from './check.js';

export function toDefaultValue(value: unknown): unknown {
  if (typeof value === 'function') {
    const tmp = value();
    if (tmp instanceof DataTypes.AbstractDataType) {
      return tmp.toSql();
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
    return new Date();
  }

  if (Array.isArray(value)) {
    return [...value];
  }

  if (isPlainObject(value)) {
    return { ...(value as object) };
  }

  return value;
}

export function quoteIdentifier(identifier: string, leftTick: string, rightTick: string): string {
  if (!isString(identifier)) {
    throw new Error(`quoteIdentifier received a non-string identifier: ${NodeUtil.inspect(identifier)}`);
  }

  // TODO [engine:node@>14]: drop regexp, use replaceAll with a string instead.
  const leftTickRegExp = new RegExp(`\\${leftTick}`, 'g');

  if (leftTick === rightTick) {
    return leftTick + identifier.replace(leftTickRegExp, leftTick + leftTick) + rightTick;
  }

  const rightTickRegExp = new RegExp(`\\${rightTick}`, 'g');

  return leftTick
    + identifier.replace(leftTickRegExp, leftTick + leftTick).replace(rightTickRegExp, rightTick + rightTick)
    + rightTick;
}
