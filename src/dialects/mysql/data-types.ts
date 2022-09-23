import dayjs from 'dayjs';
import wkx from 'wkx';
import type { Falsy } from '../../generic/falsy.js';
import type { GeoJson } from '../../geo-json.js';
import { isValidTimeZone } from '../../utils/dayjs';
import { isString } from '../../utils/index.js';
import * as BaseTypes from '../abstract/data-types.js';
import type {
  AcceptedDate,
  StringifyOptions,
  ToSqlOptions,
  BindParamOptions, ParseOptions,
} from '../abstract/data-types.js';
import type { MySqlTypeCastValue } from './connection-manager.js';

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

export class BIGINT extends BaseTypes.BIGINT {
  parse(value: MySqlTypeCastValue): unknown {
    return value.string();
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql() {
    return 'TINYINT(1)';
  }

  escape(value: boolean | Falsy): string {
    // must be 'true' & 'false' when inlining so the values are compatible with the 'IS' operator
    return value ? 'true' : 'false';
  }

  toBindableValue(value: boolean | Falsy): unknown {
    // when binding, must be an integer
    return value ? 1 : 0;
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

  parse(value: MySqlTypeCastValue, options: ParseOptions): unknown {
    const valueStr = value.string();
    if (valueStr === null) {
      return null;
    }

    const timeZone = options.dialect.sequelize.options.timezone;
    if (timeZone === '+00:00') { // default value
      // mysql returns a UTC date string that looks like the following:
      // 2022-01-01 00:00:00
      // The above does not specify a time zone offset, so Date.parse will try to parse it as a local time.
      // Adding +00 fixes this.
      return `${valueStr}+00`;
    }

    if (isValidTimeZone(timeZone)) {
      return dayjs.tz(valueStr, timeZone).toISOString();
    }

    // offset format, we can just append.
    // "2022-09-22 20:03:06" with timeZone "-04:00"
    // becomes "2022-09-22 20:03:06-04:00"
    return valueStr + timeZone;
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  parse(value: MySqlTypeCastValue): unknown {
    return value.string();
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'CHAR(36) BINARY';
  }
}

export class GEOMETRY extends BaseTypes.GEOMETRY {
  toBindableValue(value: GeoJson, options: StringifyOptions) {
    return `ST_GeomFromText(${options.escape(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )})`;
  }

  bindParam(value: GeoJson, options: BindParamOptions) {
    return `ST_GeomFromText(${options.bindParam(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )})`;
  }

  parse(value: MySqlTypeCastValue): unknown {
    let buffer = value.buffer();
    // Empty buffer, MySQL doesn't support POINT EMPTY
    // check, https://dev.mysql.com/worklog/task/?id=2381
    if (!buffer || buffer.length === 0) {
      return null;
    }

    // For some reason, discard the first 4 bytes
    buffer = buffer.slice(4);

    return wkx.Geometry.parse(buffer).toGeoJSON({ shortCrs: true });
  }

  toSql() {
    return this.options.type?.toUpperCase() || 'GEOMETRY';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql(options: ToSqlOptions) {
    return `ENUM(${this.options.values.map(value => options.dialect.escapeString(value)).join(', ')})`;
  }
}
