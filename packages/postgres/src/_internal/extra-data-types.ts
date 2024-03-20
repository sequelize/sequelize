import type {
  AbstractDialect,
  BindParamOptions,
  DataTypeClassOrInstance,
  Rangable,
  RangePart,
} from '@sequelize/core';
import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { throwUnsupportedDataType } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/data-types-utils.js';
import type {
  AcceptableTypeOf,
  BaseNumberDataType,
  DATE,
  DATEONLY,
  INTEGER,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/data-types.js';
import {
  AbstractRange,
  DataTypeIdentifier,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/data-types.js';
import { isBigInt, isNumber, isPlainObject, isString } from '@sequelize/utils';
import identity from 'lodash/identity.js';
import util from 'node:util';
import type { HstoreRecord } from './hstore.js';
import * as Hstore from './hstore.js';
import * as RangeParser from './range.js';
import { buildRangeParser } from './range.js';

/**
 * A key / value store column. Only available in Postgres.
 *
 * __Fallback policy:__
 * If the dialect does not support this type natively, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.HSTORE
 * ```
 *
 * @category DataTypes
 */
export class HSTORE extends DataTypes.ABSTRACT<HstoreRecord> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'HSTORE';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    if (!dialect.supports.dataTypes.HSTORE) {
      throwUnsupportedDataType(dialect, 'HSTORE');
    }
  }

  validate(value: any) {
    if (!isPlainObject(value)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid hstore, it must be a plain object', value),
      );
    }

    const hstore = value as Record<PropertyKey, unknown>;

    for (const key of Object.keys(hstore)) {
      if (!isString(hstore[key])) {
        ValidationErrorItem.throwDataTypeValidationError(
          util.format(
            `%O is not a valid hstore, its values must be strings but ${key} is %O`,
            hstore,
            hstore[key],
          ),
        );
      }
    }
  }

  toBindableValue(value: HstoreRecord): string {
    if (value == null) {
      return value;
    }

    return Hstore.stringify(value);
  }

  toSql(): string {
    return 'HSTORE';
  }
}

export interface RangeOptions {
  subtype?: DataTypeClassOrInstance;
}

const defaultRangeParser = buildRangeParser(identity);

/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in Postgres. See [the Postgres documentation](http://www.postgresql.org/docs/9.4/static/rangetypes.html) for more details
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * // A range of integers
 * DataTypes.RANGE(DataTypes.INTEGER)
 * // A range of bigints
 * DataTypes.RANGE(DataTypes.BIGINT)
 * // A range of decimals
 * DataTypes.RANGE(DataTypes.DECIMAL)
 * // A range of timestamps
 * DataTypes.RANGE(DataTypes.DATE)
 * // A range of dates
 * DataTypes.RANGE(DataTypes.DATEONLY)
 * ```
 *
 * @category DataTypes
 */
export class RANGE<
  T extends BaseNumberDataType | DATE | DATEONLY = INTEGER,
> extends AbstractRange<T> {
  parseDatabaseValue(value: unknown): unknown {
    // node-postgres workaround: The SQL Type-based parser is not called by node-postgres for values returned by Model.findOrCreate.
    if (typeof value === 'string') {
      value = defaultRangeParser(value);
    }

    if (!Array.isArray(value)) {
      throw new Error(
        `DataTypes.RANGE received a non-range value from the database: ${util.inspect(value)}`,
      );
    }

    return value.map(part => {
      return {
        ...part,
        value: this.options.subtype.parseDatabaseValue(part.value),
      };
    });
  }

  sanitize(value: unknown): unknown {
    if (!Array.isArray(value)) {
      return value;
    }

    // this is the "empty" range, which is not the same value as "(,)" (represented by [null, null])
    if (value.length === 0) {
      return value;
    }

    let [low, high] = value;
    if (!isPlainObject(low)) {
      low = { value: low ?? null, inclusive: true };
    }

    if (!isPlainObject(high)) {
      high = { value: high ?? null, inclusive: false };
    }

    return [this.#sanitizeSide(low), this.#sanitizeSide(high)];
  }

  #sanitizeSide(rangePart: RangePart<unknown>) {
    if (rangePart.value == null) {
      return rangePart;
    }

    return { ...rangePart, value: this.options.subtype.sanitize(rangePart.value) };
  }

  validate(value: any) {
    if (!Array.isArray(value) || (value.length !== 2 && value.length !== 0)) {
      ValidationErrorItem.throwDataTypeValidationError(
        `A range must either be an array with two elements, or an empty array for the empty range. Got ${util.inspect(value)}.`,
      );
    }
  }

  toBindableValue(values: Rangable<AcceptableTypeOf<T>>): string {
    if (!Array.isArray(values)) {
      throw new TypeError('Range values must be an array');
    }

    return RangeParser.stringify(values, rangePart => {
      let out = this.options.subtype.toBindableValue(rangePart);

      if (isNumber(out) || isBigInt(out)) {
        out = String(out);
      }

      if (!isString(out)) {
        throw new Error(
          'DataTypes.RANGE only accepts types that are represented by either strings, numbers or bigints.',
        );
      }

      return out;
    });
  }

  escape(values: Rangable<AcceptableTypeOf<T>>): string {
    const value = this.toBindableValue(values);
    const dialect = this._getDialect();

    return `${dialect.escapeString(value)}::${this.toSql()}`;
  }

  getBindParamSql(values: Rangable<AcceptableTypeOf<T>>, options: BindParamOptions): string {
    const value = this.toBindableValue(values);

    return `${options.bindParam(value)}::${this.toSql()}`;
  }

  toSql() {
    const subTypeClass = this.options.subtype;

    return RANGE.typeMap[subTypeClass.getDataTypeId().toLowerCase()];
  }

  static typeMap: Record<string, string> = {
    integer: 'int4range',
    decimal: 'numrange',
    date: 'tstzrange',
    dateonly: 'daterange',
    bigint: 'int8range',
  };
}
