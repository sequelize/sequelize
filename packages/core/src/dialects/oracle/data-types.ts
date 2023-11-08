import type { Falsy } from '../../generic/falsy';
import * as Basetypes from '../abstract/data-types.js';
import type { AbstractDialect } from '../abstract/index.js';
import type { Lib } from './connection-manager.js';
import type { AcceptedDate, BindParamOptions } from '../abstract/data-types.js';

export class STRING extends Basetypes.STRING {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    // @ts-expect-error -- Object is possibly 'null'.
    if (this.options.length > 4000 || this.options.binary && this.options.length > 2000) {
      dialect.warnDataTypeIssue(`Oracle supports length up to 32764 bytes or characters; Be sure that your administrator has extended the MAX_STRING_SIZE parameter. Check https://docs.oracle.com/pls/topic/lookup?ctx=dblatest&id=GUID-7B72E154-677A-4342-A1EA-C74C1EA928E6`);
    }
  }

  toSql() {
    if (!this.options.binary) {
      return `NVARCHAR2(${this.options.length})`;
    }

    return `RAW${this.options.length}`;
  }

  _getBindDef(oracledb: Lib) {
    if (this.options.binary) {
      return { type: oracledb.DB_TYPE_RAW, maxSize: this.options.length };
    }

    return { type: oracledb.DB_TYPE_VARCHAR, maxSize: this.options.length };
  }
}

export class BOOLEAN extends Basetypes.BOOLEAN {
  toSql() {
    return 'CHAR(1)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_CHAR, maxSize: 1 };
  }

  escape(value: true | Falsy): string {
    return value ? '1' : '0';
  }

  toBindableValue(value: boolean | Falsy): unknown {
    return value ? '1' : '0';
  }
}

export class UUID extends Basetypes.UUID {
  toSql() {
    return 'VARCHAR2(36)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_VARCHAR, maxSize: 36 };
  }
}

export class NOW extends Basetypes.NOW {
  toSql(): string {
    return 'SYSDATE';
  }
}

export class ENUM<Member extends string> extends Basetypes.ENUM<Member> {
  toSql() {
    return 'VARCHAR2(512)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_VARCHAR, maxSize: 512 };
  }
}

export class TEXT extends Basetypes.TEXT {
  toSql() {
    return 'CLOB';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_CLOB };
  }
}

export class CHAR extends Basetypes.CHAR {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    if (this.options.binary) {
      dialect.warnDataTypeIssue('Oracle CHAR.BINARY datatype is not of Fixed Length.');
    }
  }

  toSql() {
    if (this.options.binary) {
      return `RAW(${this.options.length})`;
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

export class DATE extends Basetypes.DATE {
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

    return `TO_TIMESTAMP_TZ(${formatedDate}, ${format})`;
  }

  /**
     * avoids appending TO_TIMESTAMP_TZ in toBindableValue()
     *
     * @override
     */
  getBindParamSql(value: AcceptedDate, options: BindParamOptions): string {
    return options.bindParam(value);
  }
  // TODO: parse() and override _applyTimeZone()
}

export class DECIMAL extends Basetypes.DECIMAL {
  toSql() {
    let result: string = 'NUMBER';
    if (!this.options.precision) {
      return result;
    }

    result += `(${this.options.precision}`;

    if (this.options.scale) {
      result += `,${this.options.scale}`;
    }

    result += ')';

    return result;
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }
}

export class TINYINT extends Basetypes.TINYINT {
  toSql() {
    return 'NUMBER(3)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }
}

export class SMALLINT extends Basetypes.SMALLINT {
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

export class MEDIUMINT extends Basetypes.MEDIUMINT {
  toSql() {
    return 'NUMBER(8)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }
}

export class INTEGER extends Basetypes.INTEGER {
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

export class BIGINT extends Basetypes.BIGINT { // TODO:check for constructor
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    if (this.options.length || this.options.zerofill) {
      dialect.warnDataTypeIssue(`${dialect.name} does not support BIGINT with options.`);
      delete this.options.length;
      this.options.zerofill = undefined;
    }
  }

  toSql(): string {
    return 'NUMBER(19)';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_NUMBER };
  }

  sanitize(value: any) {
    if (typeof value === 'bigint' || typeof value === 'number') {
      return value.toString();
    }

    return value;
  }
}

export class FLOAT extends Basetypes.FLOAT {
  toSql() {
    return 'BINARY_FLOAT';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_BINARY_FLOAT };
  }
}

export class BLOB extends Basetypes.BLOB {
  toSql(): string {
    return 'BLOB';
  }
  // check for hexify

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_BLOB };
  }
}

export class JSON extends Basetypes.JSON {
  toSql(): string {
    return 'BLOB';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_BLOB };
  }

  // TODO: _bindParam and stringify alternate
}

export class DOUBLE extends Basetypes.DOUBLE {
  protected getNumberSqlTypeName(): string {
    return 'DOUBLE PRECISION';
  }

  protected _checkOptionSupport(dialect: AbstractDialect): void {
    super._checkOptionSupport(dialect);

    if (this.options.zerofill) {
      dialect.warnDataTypeIssue(`${dialect.name}: ${this.getDataTypeId} doesn't support zerofill option.`);
    }
  }

  toSql(): string {
    return 'BINARY_DOUBLE';
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_BINARY_DOUBLE };
  }
}

export class DATEONLY extends Basetypes.DATEONLY {
  // parse()
  toBindableValue(date: AcceptedDate) {
    if (date) {
      const format = 'YYYY/MM/DD';

      return this.escape(`TO_DATE('${date}','${format}')`);
    }

    return this.escape(date);
  }

  _getBindDef(oracledb: Lib) {
    return { type: oracledb.DB_TYPE_DATE };
  }

  // _bindParam() for escape....
}

