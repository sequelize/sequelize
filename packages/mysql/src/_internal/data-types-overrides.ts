import type { BindParamOptions, GeoJson } from '@sequelize/core';
import type { AcceptedDate } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import { isValidTimeZone } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dayjs.js';
import { isString } from '@sequelize/utils';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import wkx from 'wkx';

dayjs.extend(utc);
dayjs.extend(timezone);

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

  escape(value: boolean | unknown): string {
    // must be 'true' & 'false' when inlining so the values are compatible with the 'IS' operator
    return value ? 'true' : 'false';
  }

  toBindableValue(value: boolean | unknown): unknown {
    // when binding, must be an integer
    return value ? 1 : 0;
  }
}

export class DATE extends BaseTypes.DATE {
  toBindableValue(date: AcceptedDate) {
    date = this._applyTimezone(date);

    // MySQL datetime precision defaults to 0
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

export class JSON extends BaseTypes.JSON {
  escape(value: any): string {
    // In MySQL, JSON cannot be directly compared to a text, we need to cast it to JSON
    // This is not necessary for the values of INSERT & UPDATE statements, so we could omit this
    // if we add context to the escape & getBindParamSql methods
    return `CAST(${super.escape(value)} AS JSON)`;
  }

  getBindParamSql(value: any, options: BindParamOptions): string {
    return `CAST(${super.getBindParamSql(value, options)} AS JSON)`;
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

    return `ST_GeomFromText(${options.bindParam(wkx.Geometry.parseGeoJSON(value).toWkt())}${srid})`;
  }

  toSql() {
    const sql = this.options.type?.toUpperCase() || 'GEOMETRY';

    if (this.options.srid) {
      // According to the documentation examples the format is: POINT NOT NULL SRID 4326
      // however in practise the order of NOT NULL and the SRID specification doesn't seem to matter.
      // Using the /*!80003 ... */ syntax is for backwards compat with MySQL versions before 8.0: MySQL 5.7 doesn't support SRIDs on table columns.
      return `${sql} /*!80003 SRID ${this.options.srid} */`;
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
