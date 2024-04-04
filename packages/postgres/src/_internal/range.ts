import type { InputRangePart, Rangable, Range, RangePart } from '@sequelize/core';
import isPlainObject from 'lodash/isPlainObject';
import NodeUtil from 'node:util';

function stringifyRangeBound<T extends {}>(
  bound: T | number | null,
  stringifyBoundary: (val: T) => string,
): string {
  if (bound === null) {
    return '';
  }

  if (bound === Number.POSITIVE_INFINITY || bound === Number.NEGATIVE_INFINITY) {
    return bound.toString().toLowerCase();
  }

  return stringifyBoundary(bound as T);
}

type ParseValue<T> = (input: string) => T;

function parseRangeBound<T>(bound: string, parseType: ParseValue<T>): T | number | null {
  if (!bound) {
    return null;
  }

  if (bound === 'infinity') {
    return Number.POSITIVE_INFINITY;
  }

  if (bound === '-infinity') {
    return Number.NEGATIVE_INFINITY;
  }

  if (bound.startsWith('"')) {
    bound = bound.slice(1);
  }

  if (bound.endsWith('"')) {
    bound = bound.slice(0, -1);
  }

  return parseType(bound);
}

export function stringifyRange<T extends {}>(
  range: Rangable<T>,
  stringifyBoundary: (val: T) => string,
): string {
  if (range.length === 0) {
    return 'empty';
  }

  if (range.length !== 2) {
    throw new Error('range array length must be 0 (empty) or 2 (lower and upper bounds)');
  }

  const inclusivity = [true, false];
  const bounds = range.map((rangePart, index) => {
    if (isInputRangePart<T>(rangePart)) {
      if (typeof rangePart.inclusive === 'boolean') {
        inclusivity[index] = rangePart.inclusive;
      }

      rangePart = rangePart.value;
    }

    return stringifyRangeBound(rangePart, stringifyBoundary);
  });

  return `${(inclusivity[0] ? '[' : '(') + bounds[0]},${bounds[1]}${inclusivity[1] ? ']' : ')'}`;
}

export function parseRange<T>(value: string, parser: ParseValue<T>): Range<T> {
  if (typeof value !== 'string') {
    throw new TypeError(`Sequelize could not parse range "${value}" as its format is incompatible`);
  }

  if (value === 'empty') {
    return [];
  }

  const result = value.slice(1, -1).split(',', 2);

  if (result.length !== 2) {
    throw new TypeError(`Sequelize could not parse range "${value}" as its format is incompatible`);
  }

  return result.map((item, index) => {
    const part: RangePart<T | number | null> = {
      value: parseRangeBound(item, parser),
      inclusive: index === 0 ? value.startsWith('[') : value.endsWith(']'),
    };

    return part;
  }) as Range<T>;
}

export function isInputRangePart<T>(val: unknown): val is InputRangePart<T> {
  return isPlainObject(val) && Object.hasOwn(val as object, 'value');
}

export function buildRangeParser(
  subTypeParser: (value: unknown) => unknown,
): (value: unknown) => unknown {
  return (value: unknown) => {
    if (typeof value !== 'string') {
      throw new TypeError(
        NodeUtil.format(
          `Sequelize could not parse range "%O" as its format is incompatible`,
          value,
        ),
      );
    }

    return parseRange(value, subTypeParser);
  };
}
