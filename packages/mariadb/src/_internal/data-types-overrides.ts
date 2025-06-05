import type { BindParamOptions, GeoJson } from '@sequelize/core';
import type { AcceptedDate } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import dayjs from 'dayjs';
import wkx from 'wkx';

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
    // MariaDB datetime precision defaults to 0
    const precision = this.options.precision ?? 0;
    let format = 'YYYY-MM-DD HH:mm:ss';
    // TODO: We should normally use `S`, `SS` or `SSS` based on the precision, but
    //  dayjs has a bug which causes `S` and `SS` to be ignored:
    //  https://github.com/iamkun/dayjs/issues/1734
    if (precision > 0) {
      format += `.SSS`;
    }

    // MariaDB sets the timezone DB-side, and the input doesn't specify the timezone offset, so we have to offset the value ourselves
    // TODO: remove the applyTimezone call when data type is limited to plain only
    return this.options.plain
      ? dayjs(date).format(format)
      : this._applyTimezone(date).format(format);
  }

  toSql() {
    if (this.options.precision != null) {
      return `DATETIME(${this.options.precision})`;
    }

    return 'DATETIME';
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
