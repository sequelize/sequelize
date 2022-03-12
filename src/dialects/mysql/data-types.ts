'use strict';

// TODO: add types for lodash
// @ts-expect-error missing types
import isEmpty from 'lodash/isEmpty';
import moment from 'moment';
import momentTz from 'moment-timezone';
// mysql2 is what sequelize actually uses for mysql, but the typing is bad
// and mysql typings should be more accurate for type casts.
import type { TypeCast } from 'mysql';
import wkx from 'wkx';
import { kSetDialectNames } from '../../dialect-toolbox';
import * as BaseTypes from '../abstract/data-types';
import type {
  AcceptableTypeOf,
  StringifyOptions,
  GeometryParams,
} from '../abstract/data-types';

/**
 * types: [buffer_type, ...]
 *
 * @see buffer_type here https://dev.mysql.com/doc/refman/5.7/en/c-api-prepared-statement-type-codes.html
 * @see hex here https://github.com/sidorares/node-mysql2/blob/master/lib/constants/types.js
 */

BaseTypes.DATE[kSetDialectNames]('mysql', ['DATETIME']);

BaseTypes.STRING[kSetDialectNames]('mysql', ['VAR_STRING']);
BaseTypes.CHAR[kSetDialectNames]('mysql', ['STRING']);
BaseTypes.TEXT[kSetDialectNames]('mysql', ['BLOB']);
BaseTypes.TINYINT[kSetDialectNames]('mysql', ['TINY']);
BaseTypes.SMALLINT[kSetDialectNames]('mysql', ['SHORT']);
BaseTypes.MEDIUMINT[kSetDialectNames]('mysql', ['INT24']);
BaseTypes.INTEGER[kSetDialectNames]('mysql', ['LONG']);
BaseTypes.BIGINT[kSetDialectNames]('mysql', ['LONGLONG']);
BaseTypes.FLOAT[kSetDialectNames]('mysql', ['FLOAT']);
BaseTypes.TIME[kSetDialectNames]('mysql', ['TIME']);
BaseTypes.DATEONLY[kSetDialectNames]('mysql', ['DATE']);
BaseTypes.BOOLEAN[kSetDialectNames]('mysql', ['TINY']);
BaseTypes.BLOB[kSetDialectNames]('mysql', ['TINYBLOB', 'BLOB', 'LONGBLOB']);
BaseTypes.DECIMAL[kSetDialectNames]('mysql', ['NEWDECIMAL']);
BaseTypes.UUID[kSetDialectNames]('mysql', false);
BaseTypes.ENUM[kSetDialectNames]('mysql', false);
BaseTypes.REAL[kSetDialectNames]('mysql', ['DOUBLE']);
BaseTypes.DOUBLE[kSetDialectNames]('mysql', ['DOUBLE']);
BaseTypes.GEOMETRY[kSetDialectNames]('mysql', ['GEOMETRY']);
BaseTypes.JSON[kSetDialectNames]('mysql', ['JSON']);

export class DECIMAL extends BaseTypes.DECIMAL {
  toSql() {
    let definition = super.toSql();
    if (this._unsigned) {
      definition += ' UNSIGNED';
    }

    if (this._zerofill) {
      definition += ' ZEROFILL';
    }

    return definition;
  }
}

type RawMySQLValue = Parameters<Exclude<TypeCast, boolean>>[0];
// TODO: Update this type when the rest of the mysql-specific code is typed.
export interface MySqlParseOptions {
  timezone: string;
}

export class DATE extends BaseTypes.DATE {
  toSql() {
    return this._length ? `DATETIME(${this._length})` : 'DATETIME';
  }

  protected _stringify(
    date: AcceptableTypeOf<BaseTypes.DATE>,
    options: StringifyOptions,
  ) {
    if (!moment.isMoment(date)) {
      date = this._applyTimezone(date, options);
    }

    // Fractional DATETIMEs only supported on MySQL 5.6.4+
    if (this._length) {
      return date.format('YYYY-MM-DD HH:mm:ss.SSS');
    }

    return date.format('YYYY-MM-DD HH:mm:ss');
  }

  static parse(value: RawMySQLValue, options: MySqlParseOptions): Date | null {
    const text = value.string();

    if (text === null) {
      return null;
    }

    if (momentTz.tz.zone(options.timezone)) {
      return momentTz.tz(value, options.timezone).toDate();
    }

    return new Date(`${value} ${options.timezone}`);
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  static parse(value: RawMySQLValue) {
    return value.string();
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'CHAR(36) BINARY';
  }
}

const SUPPORTED_GEOMETRY_TYPES = ['POINT', 'LINESTRING', 'POLYGON'] as const;

export class GEOMETRY<
  Type extends typeof SUPPORTED_GEOMETRY_TYPES[number] = typeof SUPPORTED_GEOMETRY_TYPES[number],
> extends BaseTypes.GEOMETRY<Type> {
  protected sqlType: string;

  constructor(...args: GeometryParams<Type>) {
    super(...args);

    if (isEmpty(this.type)) {
      this.sqlType = this.key;

      return;
    }

    if (this.type && SUPPORTED_GEOMETRY_TYPES.includes(this.type)) {
      this.sqlType = this.type;

      return;
    }

    throw new Error(
      `Supported geometry types are: ${SUPPORTED_GEOMETRY_TYPES.join(', ')}`,
    );
  }

  static parse(value: RawMySQLValue) {
    let buf = value.buffer();
    // Empty buffer, MySQL doesn't support POINT EMPTY
    // check, https://dev.mysql.com/worklog/task/?id=2381
    if (!buf || buf.length === 0) {
      return null;
    }

    // For some reason, discard the first 4 bytes
    buf = buf.slice(4);

    return wkx.Geometry.parse(buf).toGeoJSON({ shortCrs: true });
  }

  toSql() {
    return this.sqlType;
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql(options: StringifyOptions) {
    return `ENUM(${this.values
      .map(value => options.escape(value))
      .join(', ')})`;
  }
}

export class JSONTYPE extends BaseTypes.JSON {
  _stringify(value: any, options: StringifyOptions) {
    return options.operation === 'where' && typeof value === 'string'
      ? value
      : JSON.stringify(value);
  }
}
