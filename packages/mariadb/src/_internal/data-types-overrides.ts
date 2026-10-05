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
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql() {
    return 'TINYINT(1)';
  }

  toBindableValue(value: boolean | unknown): unknown {
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
  escape(value: GeoJson): string {
    const dialect = this._getDialect();

    return this.#toSqlFunctionCall(value, param => {
      return typeof param === 'number' ? String(param) : dialect.escapeString(param);
    });
  }

  toBindableValue(value: GeoJson) {
    return this.escape(value);
  }

  getBindParamSql(value: GeoJson, options: BindParamOptions) {
    return this.#toSqlFunctionCall(value, param => options.bindParam(param));
  }

  #toSqlFunctionCall(value: GeoJson, toSqlParam: (param: string | number) => string): string {
    const { wkt, srid } = geoJsonToWkt(value, this.options.srid);

    // Unlike MySQL, MariaDB does not swap the axes of geographic SRSs: WKT is always parsed as X Y (longitude latitude)
    return srid
      ? `ST_GeomFromText(${toSqlParam(wkt)}, ${toSqlParam(srid)})`
      : `ST_GeomFromText(${toSqlParam(wkt)})`;
  }

  toSql() {
    const sql = this.options.type?.toUpperCase() || 'GEOMETRY';

    if (this.options.srid) {
      return `${sql} REF_SYSTEM_ID=${this.options.srid}`;
    }

    return sql;
  }
}

function geoJsonToWkt(
  value: GeoJson,
  columnSrid: number | undefined,
): { wkt: string; srid: number | undefined } {
  const geometry = wkx.Geometry.parseGeoJSON(value);

  // wkx defaults the SRID to 4326 if the GeoJSON does not specify a named crs,
  // in which case we want to use the SRID of the column instead.
  if (value.crs?.type !== 'name' || !value.crs.properties?.name) {
    return { wkt: geometry.toWkt(), srid: columnSrid };
  }

  // wkx only parses the digits at the start of the SRID, so we validate the whole name ourselves
  const sridMatch = /^(?:EPSG:|urn:ogc:def:crs:EPSG::)(\d+)$/.exec(value.crs.properties.name);
  if (!sridMatch) {
    throw new Error(`Invalid SRID in GeoJSON crs: ${value.crs.properties.name}`);
  }

  const srid = Number(sridMatch[1]);

  return { wkt: geometry.toWkt(), srid };
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    const dialect = this._getDialect();

    return `ENUM(${this.options.values.map(value => dialect.escapeString(value)).join(', ')})`;
  }
}
