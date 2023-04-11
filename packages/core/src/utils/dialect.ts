import { randomUUID } from 'node:crypto';
import NodeUtil from 'node:util';
import isPlainObject from 'lodash/isPlainObject';
import { v1 as uuidv1 } from 'uuid';
import { isString } from './check.js';
import * as DataTypes from '../dialects/abstract/data-types.js';

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

/**
 * @deprecated use {@link AbstractDialect#TICK_CHAR_LEFT} and {@link AbstractDialect#TICK_CHAR_RIGHT},
 * or {@link AbstractQueryGenerator#quoteIdentifier}
 */
export const TICK_CHAR = '`';

/**
 * @deprecated this is a bad way to quote identifiers and it should not be used anymore.
 * it mangles the input if the input contains identifier quotes, which should not happen.
 * Use {@link quoteIdentifier} instead
 *
 * @param s
 * @param tickChar
 * @returns
 */
export function addTicks(s: string, tickChar: string = TICK_CHAR): string {
  return tickChar + removeTicks(s, tickChar) + tickChar;
}

/**
 * @deprecated this is a bad way to quote identifiers and it should not be used anymore.
 * Use {@link quoteIdentifier} instead
 *
 * @param s
 * @param tickChar
 * @returns
 */
export function removeTicks(s: string, tickChar: string = TICK_CHAR): string {
  return s.replace(new RegExp(tickChar, 'g'), '');
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
