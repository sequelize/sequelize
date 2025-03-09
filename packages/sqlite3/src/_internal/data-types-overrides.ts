import type { AbstractDialect } from '@sequelize/core';
import { BaseError } from '@sequelize/core';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import NodeUtil from 'node:util';

function removeUnsupportedIntegerOptions(
  dataType: BaseTypes.BaseIntegerDataType,
  dialect: AbstractDialect,
) {
  if (dataType.options.length != null) {
    dialect.warnDataTypeIssue(
      `${dialect.name} does not support '${dataType.getDataTypeId()}' with length. This option will be ignored.`,
    );
    delete dataType.options.length;
  }
}

function removeUnsupportedDecimalNumberOptions(
  dataType: BaseTypes.BaseDecimalNumberDataType,
  dialect: AbstractDialect,
) {
  if (dataType.options.scale != null || dataType.options.precision != null) {
    dialect.warnDataTypeIssue(
      `${dialect.name} does not support '${dataType.getDataTypeId()}' with "scale" or "precision" specified. These options will be ignored.`,
    );
    dataType.options.scale = undefined;
    dataType.options.precision = undefined;
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  // Note: the BOOLEAN type is SQLite maps to NUMERIC, but we still use BOOLEAN because introspecting the table
  // still indicates that the column is a BOOLEAN column - which we may be able to exploit in the future to parse the value
  // in raw queries where the DataType is not available.

  escape(value: boolean | unknown): string {
    return value ? '1' : '0';
  }

  toBindableValue(value: boolean | unknown): unknown {
    return value ? 1 : 0;
  }

  toSql(): string {
    return 'INTEGER';
  }
}

export class STRING extends BaseTypes.STRING {
  // TODO: add length check constraint
  //  check(length(col) <= 5))
  toSql() {
    if (this.options.binary) {
      return `TEXT COLLATE BINARY`;
    }

    return 'TEXT';
  }
}

export class TEXT extends BaseTypes.TEXT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.length) {
      dialect.warnDataTypeIssue(
        `${dialect.name} does not support TEXT with options. Plain 'TEXT' will be used instead.`,
      );
      this.options.length = undefined;
    }
  }
}

export class CITEXT extends BaseTypes.CITEXT {
  toSql() {
    return 'TEXT COLLATE NOCASE';
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^8-1 check when the unsigned option is true
  // TODO: add >= -2^7 =< 2^7-1 check when the unsigned option is false

  toSql(): string {
    return 'INTEGER';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^16-1 check when the unsigned option is true
  // TODO: add >= -2^15 =< 2^15-1 check when the unsigned option is false

  toSql(): string {
    return 'INTEGER';
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^24-1 check when the unsigned option is true
  // TODO: add >= -2^23 =< 2^23-1 check when the unsigned option is false

  toSql(): string {
    return 'INTEGER';
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^32-1 check when the unsigned option is true
  // TODO: add >= -2^31 =< 2^31-1 check when the unsigned option is false

  toSql(): string {
    return 'INTEGER';
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedDecimalNumberOptions(this, dialect);
    dialect.warnDataTypeIssue(
      `${dialect.name} does not support single-precision floating point numbers. SQLite's REAL type will be used instead, which in SQLite is a double-precision floating point type.`,
    );
  }

  // TODO: add check constraint >= 0 if unsigned is true

  protected getNumberSqlTypeName(): string {
    return 'REAL';
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedDecimalNumberOptions(this, dialect);
  }

  // TODO: add check constraint >= 0 if unsigned is true

  protected getNumberSqlTypeName(): string {
    // in SQLite, REAL is 8 bytes, not 4.
    return 'REAL';
  }
}

/**
 * @deprecated use FLOAT.
 */
export class REAL extends BaseTypes.REAL {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedDecimalNumberOptions(this, dialect);
  }

  protected getNumberSqlTypeName(): string {
    // in SQLite, REAL is 8 bytes, not 4.
    return 'REAL';
  }
}

export class TIME extends BaseTypes.TIME {
  // TODO: add CHECK constraint
  //  https://github.com/sequelize/sequelize/pull/14505#issuecomment-1259279743

  toSql(): string {
    return 'TEXT';
  }
}

export class DATE extends BaseTypes.DATE {
  // TODO: add CHECK constraint
  //  https://github.com/sequelize/sequelize/pull/14505#issuecomment-1259279743

  toSql(): string {
    return 'TEXT';
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  // TODO: add CHECK constraint
  //  https://github.com/sequelize/sequelize/pull/14505#issuecomment-1259279743

  toSql(): string {
    return 'TEXT';
  }
}

export class BLOB extends BaseTypes.BLOB {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.length) {
      dialect.warnDataTypeIssue(
        `${dialect.name} does not support '${this.getDataTypeId()}' with length. This option will be ignored.`,
      );
      delete this.options.length;
    }
  }

  toSql() {
    return 'BLOB';
  }
}

export class JSON extends BaseTypes.JSON {
  parseDatabaseValue(value: unknown): unknown {
    // sqlite3 being sqlite3, JSON numbers are returned as JS numbers, but everything else is returned as a JSON string
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value !== 'string') {
      throw new Error(
        `DataTypes.JSON received a non-string value from the database, which it cannot parse: ${NodeUtil.inspect(value)}.`,
      );
    }

    try {
      return globalThis.JSON.parse(value);
    } catch (error) {
      throw new BaseError(
        `DataTypes.JSON received a value from the database that it not valid JSON: ${NodeUtil.inspect(value)}.`,
        { cause: error },
      );
    }
  }

  // TODO: add check constraint
  //  https://www.sqlite.org/json1.html#jvalid
  toSql(): string {
    return 'TEXT';
  }
}

export class UUID extends BaseTypes.UUID {
  // TODO: add check constraint to enforce GUID format
  toSql() {
    return 'TEXT';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  // TODO: add check constraint to enforce list of accepted values
  toSql() {
    return 'TEXT';
  }
}
