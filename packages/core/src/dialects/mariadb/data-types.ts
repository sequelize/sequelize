import dayjs from 'dayjs';
import wkx from 'wkx';
import type { Falsy } from '../../generic/falsy.js';
import type { GeoJson } from '../../geo-json.js';
import { isString } from '../../utils/check.js';
import { isValidTimeZone } from '../../utils/dayjs';
import * as BaseTypes from '../abstract/data-types.js';
import type { AcceptedDate, BindParamOptions } from '../abstract/data-types.js';

export class FLOAT extends BaseTypes.FLOAT {
  protected getNumberSqlTypeName(): string {
    return 'FLOAT';
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql() {
    return 'TINYINT(1)';
  }

  toBindableValue(value: boolean | Falsy): unknown {
    // when binding, must be an integer
    return value ? 1 : 0;
  }
}

export class DATE extends BaseTypes.DATE {
  toBindableValue(date: AcceptedDate) {
    date = this._applyTimezone(date);

    // MariaDB datetime precision defaults to 0
    const precision = this.options.precision ?? 0;
    let format = 'YYYY-MM-DD HH:mm:ss';
    // TODO: We should normally use `S`, `SS` or `SSS` based on the precision, but
    //  dayjs has a bug which causes `S` and `SS` to be ignored:
    //  https://github.com/iamkun/dayjs/issues/1734
    if (precision > 0) {
      format += `.SSS`;
    }

    return date.format(format);
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
  // TODO: add check constraint to enforce GUID format
  toSql() {
    return 'CHAR(36) BINARY';
  }
}

export class GEOMETRY extends BaseTypes.GEOMETRY {
  toBindableValue(value: GeoJson) {
    const srid = this.options.srid ? `, ${this.options.srid}` : '';

    return `ST_GeomFromText(${this._getDialect().escapeString(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )}${srid})`;
  }

  getBindParamSql(value: GeoJson, options: BindParamOptions) {
    const srid = this.options.srid ? `, ${options.bindParam(this.options.srid)}` : '';

    return `ST_GeomFromText(${options.bindParam(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )}${srid})`;
  }

  toSql() {
    const sql = this.options.type?.toUpperCase() || 'GEOMETRY';

    if (this.options.srid) {
      return `${sql} REF_SYSTEM_ID=${this.options.srid}`;
    }

    return sql;
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    const dialect = this._getDialect();

    return `ENUM(${this.options.values.map(value => dialect.escapeString(value)).join(', ')})`;
  }
}
