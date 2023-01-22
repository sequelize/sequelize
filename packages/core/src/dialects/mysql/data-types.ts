import dayjs from 'dayjs';
import wkx from 'wkx';
import type { Falsy } from '../../generic/falsy.js';
import type { GeoJson } from '../../geo-json.js';
import { isString } from '../../utils/check.js';
import { isValidTimeZone } from '../../utils/dayjs';
import * as BaseTypes from '../abstract/data-types.js';
import type {
  AcceptedDate,
  BindParamOptions,
} from '../abstract/data-types.js';

export class FLOAT extends BaseTypes.FLOAT {
  protected getNumberSqlTypeName(): string {
    return 'FLOAT';
  }

  protected _supportsNativeUnsigned(): boolean {
    return true;
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  protected getNumberSqlTypeName(): string {
    return 'DOUBLE PRECISION';
  }

  protected _supportsNativeUnsigned(): boolean {
    return true;
  }
}

/** @deprecated */
export class REAL extends BaseTypes.REAL {
  protected _supportsNativeUnsigned(): boolean {
    return true;
  }
}

export class DECIMAL extends BaseTypes.DECIMAL {
  protected _supportsNativeUnsigned(): boolean {
    return true;
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  protected _supportsNativeUnsigned(): boolean {
    return true;
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _supportsNativeUnsigned(): boolean {
    return true;
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  protected _supportsNativeUnsigned(): boolean {
    return true;
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  protected _supportsNativeUnsigned(): boolean {
    return true;
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  protected _supportsNativeUnsigned(): boolean {
    return true;
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
  toBindableValue(date: AcceptedDate) {
    date = this._applyTimezone(date);

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
  // TODO: add check constraint to enforce GUID format
  toSql() {
    return 'CHAR(36) BINARY';
  }
}

export class GEOMETRY extends BaseTypes.GEOMETRY {
  toBindableValue(value: GeoJson) {
    return `ST_GeomFromText(${this._getDialect().escapeString(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )})`;
  }

  getBindParamSql(value: GeoJson, options: BindParamOptions) {
    return `ST_GeomFromText(${options.bindParam(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )})`;
  }

  toSql() {
    return this.options.type?.toUpperCase() || 'GEOMETRY';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    return `ENUM(${this.options.values.map(value => this._getDialect().escapeString(value)).join(', ')})`;
  }
}
