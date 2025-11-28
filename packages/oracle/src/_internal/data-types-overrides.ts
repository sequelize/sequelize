// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import type { AbstractDialect, BindParamOptions } from '@sequelize/core';
import type { AcceptedDate } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Lib = typeof import('oracledb');

dayjs.extend(utc);

// legacy support
let Moment: any;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  Moment = require('moment');
} catch {
  /* ignore */
}

function isMoment(value: any): boolean {
  return Moment?.isMoment(value) ?? false;
}

export class STRING extends BaseTypes.STRING {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    // @ts-expect-error -- Object is possibly 'null'.
    if (this.options.length > 4000 || (this.options.binary && this.options.length > 2000)) {
      dialect.warnDataTypeIssue(
        `Oracle supports length up to 32764 bytes or characters; Be sure that your administrator has extended the MAX_STRING_SIZE parameter. Check https://docs.oracle.com/pls/topic/lookup?ctx=dblatest&id=GUID-7B72E154-677A-4342-A1EA-C74C1EA928E6`,
      );
    }
  }

  toSql() {
    if (!this.options.binary) {
      return `NVARCHAR2(${this.options.length ?? 255})`;
    }

    return `RAW(${this.options.length ?? 255})`;
  }

  _getBindDef(oracledb: Lib) {
    if (this.options.binary) {
      return { type: oracledb.DB_TYPE_RAW, maxSize: this.options.length || 255 };
    }

    return { type: oracledb.DB_TYPE_VARCHAR, maxSize: this.options.length || 255 };
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql() {
    return 'CHAR(1)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_CHAR, maxSize: 1 };
  }

  escape(value: boolean): string {
    return value ? '1' : '0';
  }

  toBindableValue(value: boolean): unknown {
    return value === true ? '1' : value === false ? '0' : value;
  }

  parseDatabaseValue(value: unknown): boolean {
    if (value === '1' || value === 'true') {
      return true;
    }

    return false;
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'VARCHAR2(36)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_VARCHAR, maxSize: 36 };
  }
}

export class NOW extends BaseTypes.NOW {
  toSql(): string {
    return 'SYSDATE';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toBindableValue(value: never): unknown {
    return 'SYSDATE';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    return 'VARCHAR2(512)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_VARCHAR, maxSize: 512 };
  }
}

export class TEXT extends BaseTypes.TEXT {
  toSql() {
    return 'CLOB';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_CLOB };
  }
}

export class CHAR extends BaseTypes.CHAR {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    if (this.options.binary) {
      dialect.warnDataTypeIssue('Oracle CHAR.BINARY datatype is not of Fixed Length.');
    }
  }

  toSql() {
    if (this.options.binary) {
      return `RAW(${this.options.length ?? 255})`;
    }

    return super.toSql();
  }

  _getBindDef(oracledb: Lib) {
    if (this.options.binary) {
      return { type: oracledb.DB_TYPE_RAW, maxSize: this.options.length };
    }

    return { type: oracledb.DB_TYPE_CHAR, maxSize: this.options.length };
  }
}

export class DATE extends BaseTypes.DATE {
  toSql() {
    return 'TIMESTAMP WITH LOCAL TIME ZONE';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_TIMESTAMP_LTZ };
  }

  toBindableValue(date: AcceptedDate) {
    const format = 'YYYY-MM-DD HH24:MI:SS.FFTZH:TZM';
    date = this._applyTimezone(date);

    const formatedDate = date.format('YYYY-MM-DD HH:mm:ss.SSS Z');

    return `TO_TIMESTAMP_TZ('${formatedDate}', '${format}')`;
  }

  /**
   * avoids appending TO_TIMESTAMP_TZ in toBindableValue()
   *
   * @override
   */
  getBindParamSql(value: AcceptedDate, options: BindParamOptions): string {
    if (dayjs.isDayjs(value) || isMoment(value)) {
      return options.bindParam(this._sanitize(value));
    }

    return options.bindParam(value);
  }

  _sanitize(value: any) {
    return new Date(value);
  }
}

type AcceptedNumber = number | bigint | boolean | string | null;

export class DECIMAL extends BaseTypes.DECIMAL {
  toSql() {
    let result: string = 'NUMBER';
    if (!this.options.precision) {
      return result;
    }

    result += `(${this.options.precision}`;

    if (this.options.scale) {
      result += `, ${this.options.scale}`;
    }

    result += ')';

    return result;
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }

  // Oracle treats DECIMAL as NUMBER(precision, scale).
  sanitize(value: AcceptedNumber): AcceptedNumber {
    if (typeof value === 'bigint') {
      return value.toString();
    }

    return value;
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  toSql() {
    return 'NUMBER(3)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  toSql() {
    if (this.options.length) {
      return `NUMBER(${this.options.length},0)`;
    }

    return 'SMALLINT';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  toSql() {
    return 'NUMBER(8)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  toSql(): string {
    if (this.options.length) {
      return `NUMBER(${this.options.length},0)`;
    }

    return 'INTEGER';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }
}

/**
 * @deprecated use FLOAT.
 */
export class REAL extends BaseTypes.REAL {
  toSql() {
    return 'BINARY_DOUBLE';
  }

  // https://www.oracle.com/pls/topic/lookup?ctx=dblatest&id=GUID-0BA2E065-8006-426C-A3CB-1F6B0C8F283C
  toBindableValue(value: any) {
    if (value === Number.POSITIVE_INFINITY) {
      return 'inf';
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return '-inf';
    }

    return value;
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_BINARY_DOUBLE };
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    if (this.options.length || this.options.zerofill) {
      dialect.warnDataTypeIssue(`${dialect.name} does not support BIGINT with options.`);
      delete this.options.length;
      this.options.zerofill = undefined;
    }
  }

  toSql(): string {
    return 'NUMBER(19, 0)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  toSql() {
    return 'BINARY_FLOAT';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_BINARY_FLOAT };
  }
}

export class BLOB extends BaseTypes.BLOB {
  toSql(): string {
    return 'BLOB';
  }
  // check for hexify

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_BLOB };
  }
}

export class JSON extends BaseTypes.JSON {
  toSql(): string {
    return 'BLOB';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_BLOB };
  }

  toBindableValue(value: any): string {
    if (value === null) {
      const sequelize = this._getDialect().sequelize;

      const isExplicit = sequelize.options.nullJsonStringification === 'explicit';
      if (isExplicit) {
        throw new Error(
          `Attempted to insert the JavaScript null into a JSON column, but the "nullJsonStringification" option is set to "explicit", so Sequelize cannot decide whether to use the SQL NULL or the JSON 'null'. Use the SQL_NULL or JSON_NULL variable instead, or set the option to a different value. See https://sequelize.org/docs/v7/querying/json/ for details.`,
        );
      }
    }

    return typeof value === 'string' ? value : globalThis.JSON.stringify(value);
  }

  getBindParamSql(value: any, options: BindParamOptions): any {
    return options.bindParam(Buffer.from(globalThis.JSON.stringify(value)));
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  protected getNumberSqlTypeName(): string {
    return 'DOUBLE PRECISION';
  }

  protected _checkOptionSupport(dialect: AbstractDialect): void {
    super._checkOptionSupport(dialect);

    if (this.options.zerofill) {
      dialect.warnDataTypeIssue(
        `${dialect.name}: ${this.getDataTypeId} doesn't support zerofill option.`,
      );
    }
  }

  toSql(): string {
    return 'BINARY_DOUBLE';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_BINARY_DOUBLE };
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  toBindableValue(date: AcceptedDate) {
    if (date) {
      const format = 'YYYY/MM/DD';

      return this.escape(`TO_DATE('${date}','${format}')`);
    }

    return this.escape(date);
  }

  parseDatabaseValue(value: any) {
    if (value) {
      return dayjs.utc(value).format('YYYY-MM-DD');
    }

    return value;
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_DATE };
  }

  /**
   * avoids appending TO_DATE in toBindableValue()
   *
   * @override
   */
  getBindParamSql(value: AcceptedDate, options: BindParamOptions): string {
    if (typeof value === 'string') {
      return options.bindParam(new Date(value));
    }

    return options.bindParam(value);
  }
}
