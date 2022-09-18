import dayjs from 'dayjs';
import wkx from 'wkx';
import { setDataTypeDialectMeta } from '../../dialect-toolbox.js';
import { isValidTimeZone } from '../../utils/dayjs';
import { isString } from '../../utils/index.js';
import * as BaseTypes from '../abstract/data-types.js';
import type { AcceptedDate, StringifyOptions, ToSqlOptions, GeometryType } from '../abstract/data-types.js';

// const warn = createDataTypesWarn('https://dev.mysql.com/doc/refman/5.7/en/data-types.html');

/**
   * types: [buffer_type, ...]
   *
   * @see buffer_type here https://dev.mysql.com/doc/refman/5.7/en/c-api-prepared-statement-type-codes.html
   * @see hex here https://github.com/sidorares/node-mysql2/blob/master/lib/constants/types.js
   */

setDataTypeDialectMeta(BaseTypes.DATE, 'mysql', ['DATETIME']);
setDataTypeDialectMeta(BaseTypes.STRING, 'mysql', ['VAR_STRING']);
setDataTypeDialectMeta(BaseTypes.CHAR, 'mysql', ['STRING']);
setDataTypeDialectMeta(BaseTypes.TEXT, 'mysql', ['BLOB']);
setDataTypeDialectMeta(BaseTypes.TINYINT, 'mysql', ['TINY']);
setDataTypeDialectMeta(BaseTypes.SMALLINT, 'mysql', ['SHORT']);
setDataTypeDialectMeta(BaseTypes.MEDIUMINT, 'mysql', ['INT24']);
setDataTypeDialectMeta(BaseTypes.INTEGER, 'mysql', ['LONG']);
setDataTypeDialectMeta(BaseTypes.BIGINT, 'mysql', ['LONGLONG']);
setDataTypeDialectMeta(BaseTypes.FLOAT, 'mysql', ['FLOAT']);
setDataTypeDialectMeta(BaseTypes.TIME, 'mysql', ['TIME']);
setDataTypeDialectMeta(BaseTypes.DATEONLY, 'mysql', ['DATE']);
setDataTypeDialectMeta(BaseTypes.BOOLEAN, 'mysql', ['TINY']);
setDataTypeDialectMeta(BaseTypes.BLOB, 'mysql', ['TINYBLOB', 'BLOB', 'LONGBLOB']);
setDataTypeDialectMeta(BaseTypes.DECIMAL, 'mysql', ['NEWDECIMAL']);
setDataTypeDialectMeta(BaseTypes.UUID, 'mysql', false);
setDataTypeDialectMeta(BaseTypes.ENUM, 'mysql', false);
setDataTypeDialectMeta(BaseTypes.REAL, 'mysql', ['DOUBLE']);
setDataTypeDialectMeta(BaseTypes.DOUBLE, 'mysql', ['DOUBLE']);
setDataTypeDialectMeta(BaseTypes.GEOMETRY, 'mysql', ['GEOMETRY']);
setDataTypeDialectMeta(BaseTypes.JSON, 'mysql', ['JSON']);

export class DECIMAL extends BaseTypes.DECIMAL {
  toSql(options: ToSqlOptions) {
    let definition = super.toSql(options);
    if (this.options.unsigned) {
      definition += ' UNSIGNED';
    }

    if (this.options.unsigned) {
      definition += ' ZEROFILL';
    }

    return definition;
  }
}

export class DATE extends BaseTypes.DATE {
  toSql() {
    return this.options.length ? `DATETIME(${this.options.length})` : 'DATETIME';
  }

  toBindableValue(date: AcceptedDate, options: StringifyOptions) {
    date = this._applyTimezone(date, options);

    return date.format('YYYY-MM-DD HH:mm:ss.SSS');
  }

  sanitize(value: unknown, options?: { raw?: boolean, timezone?: string }): unknown {
    if (options?.raw) {
      return value;
    }

    if (isString(value) && options?.timezone) {
      if (isValidTimeZone(options.timezone)) {
        return dayjs.tz(value, options.timezone).toDate();
      }

      return new Date(`${value} ${options.timezone}`);
    }

    return super.sanitize(value, options);
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'CHAR(36) BINARY';
  }
}

const SUPPORTED_GEOMETRY_TYPES = ['POINT', 'LINESTRING', 'POLYGON'];

export class GEOMETRY extends BaseTypes.GEOMETRY {
  constructor(type: GeometryType, srid?: number) {
    super(type, srid);

    if (this.options.type && !SUPPORTED_GEOMETRY_TYPES.includes(this.options.type)) {
      throw new Error(`Supported geometry types are: ${SUPPORTED_GEOMETRY_TYPES.join(', ')}`);
    }
  }

  sanitize(value: unknown): unknown {
    if (!value) {
      return null;
    }

    if (!isString(value) && !Buffer.isBuffer(value)) {
      throw new Error('Invalid value for GEOMETRY type. Expected string or buffer.');
    }

    let sanitizedValue: string | Buffer = value;

    // Empty buffer, MySQL doesn't support POINT EMPTY
    // check, https://dev.mysql.com/worklog/task/?id=2381
    if (sanitizedValue.length === 0) {
      // TODO: throw
      return null;
    }

    if (Buffer.isBuffer(sanitizedValue)) {
      // For some reason, discard the first 4 bytes
      sanitizedValue = sanitizedValue.subarray(4);
    }

    return wkx.Geometry.parse(sanitizedValue).toGeoJSON({ shortCrs: true });
  }

  toSql() {
    return this.options.type || 'GEOMETRY';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql(options: ToSqlOptions) {
    return `ENUM(${this.options.values.map(value => options.dialect.escapeString(value)).join(', ')})`;
  }
}
