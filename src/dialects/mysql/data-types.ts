import dayjs from 'dayjs';
import wkx from 'wkx';
import { isValidTimeZone } from '../../utils/dayjs';
import { isString } from '../../utils/index.js';
import * as BaseTypes from '../abstract/data-types.js';
import type { AcceptedDate, StringifyOptions, ToSqlOptions, GeometryType } from '../abstract/data-types.js';

// const warn = createDataTypesWarn('https://dev.mysql.com/doc/refman/5.7/en/data-types.html');

export class DECIMAL extends BaseTypes.DECIMAL {
  toSql(options: ToSqlOptions) {
    let definition = super.toSql(options);
    if (this.options.unsigned) {
      definition += ' UNSIGNED';
    }

    if (this.options.zerofill) {
      definition += ' ZEROFILL';
    }

    return definition;
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  protected getNumberSqlTypeName(): string {
    return 'DOUBLE PRECISION';
  }
}

export class DATE extends BaseTypes.DATE {
  toBindableValue(date: AcceptedDate, options: StringifyOptions) {
    date = this._applyTimezone(date, options);

    return date.format('YYYY-MM-DD HH:mm:ss.SSS');
  }

  sanitize(value: unknown, options?: { timezone?: string }): unknown {
    if (isString(value) && options?.timezone) {
      if (isValidTimeZone(options.timezone)) {
        return dayjs.tz(value, options.timezone).toDate();
      }

      return new Date(`${value} ${options.timezone}`);
    }

    return super.sanitize(value);
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
      return value;
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
