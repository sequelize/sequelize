import type { AbstractDialect } from '@sequelize/core';
import { BaseError } from '@sequelize/core';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import maxBy from 'lodash/maxBy';
import NodeUtil from 'node:util';

function removeUnsupportedIntegerOptions(
  dataType: BaseTypes.BaseIntegerDataType,
  dialect: AbstractDialect,
) {
  if (dataType.options.length != null) {
    dialect.warnDataTypeIssue(
      `${dialect.name} does not support '${dataType.constructor.name}' with length specified. This options is ignored.`,
    );

    delete dataType.options.length;
  }
}

export class BLOB extends BaseTypes.BLOB {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    // tiny = 2^8
    // regular = 2^16
    // medium = 2^24
    // long = 2^32
    // in mssql, anything above 8000 bytes must be MAX

    if (this.options.length != null && this.options.length.toLowerCase() !== 'tiny') {
      dialect.warnDataTypeIssue(
        `${dialect.name}: ${this.getDataTypeId()} cannot limit its size beyond length=tiny. This option is ignored, in favor of the highest size possible.`,
      );
    }
  }

  toSql() {
    if (this.options.length && this.options.length.toLowerCase() === 'tiny') {
      return 'VARBINARY(256)';
    }

    return 'VARBINARY(MAX)';
  }
}

export class STRING extends BaseTypes.STRING {
  toSql() {
    return `NVARCHAR(${this.options.length ?? 255})`;
  }
}

export class TEXT extends BaseTypes.TEXT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    // tiny = 2^8
    // regular = 2^16
    // medium = 2^24
    // long = 2^32
    // in mssql, anything above 8000 bytes must be MAX

    if (this.options.length != null && this.options.length.toLowerCase() !== 'tiny') {
      dialect.warnDataTypeIssue(
        `${dialect.name}: ${this.getDataTypeId()} cannot limit its size beyond length=tiny. This option is ignored, in favor of the highest size possible.`,
      );
    }
  }

  toSql() {
    if (this.options.length && this.options.length.toLowerCase() === 'tiny') {
      return 'NVARCHAR(256)';
    }

    return 'NVARCHAR(MAX)';
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  escape(value: boolean | unknown): string {
    return value ? '1' : '0';
  }

  toBindableValue(value: boolean | unknown): unknown {
    return value ? 1 : 0;
  }

  toSql() {
    return 'BIT';
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'UNIQUEIDENTIFIER';
  }
}

export class NOW extends BaseTypes.NOW {
  toSql() {
    return 'GETDATE()';
  }
}

export class DATE extends BaseTypes.DATE {
  toSql() {
    if (this.options.precision != null) {
      return `DATETIMEOFFSET(${this.options.precision})`;
    }

    return 'DATETIMEOFFSET';
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add check constraint between -128 & 127 inclusive when the unsigned option is false

  toSql() {
    if (!this.options.unsigned) {
      return 'SMALLINT';
    }

    // tinyint is always unsigned in mssql
    return 'TINYINT';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add check constraint between 0 & 65535 inclusive when the unsigned option is true

  toSql() {
    if (this.options.unsigned) {
      return 'INT';
    }

    return 'SMALLINT';
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: unsigned: add check constraint between 0 & 16777215 inclusive
  // TODO: signed: add check constraint between -8388608 & 8388607 inclusive

  toSql() {
    return 'INTEGER';
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO:add check constraint between 0 & 4294967295 inclusive when the unsigned option is true

  toSql() {
    if (this.options.unsigned) {
      return 'BIGINT';
    }

    return 'INTEGER';
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  // TODO: add check constraint >= 0 if unsigned is true

  protected getNumberSqlTypeName(): string {
    return 'REAL';
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  // TODO: add check constraint >= 0 if unsigned is true
}

export class DECIMAL extends BaseTypes.DECIMAL {
  // TODO: add check constraint >= 0 if unsigned is true
}

// https://learn.microsoft.com/en-us/sql/relational-databases/json/json-data-sql-server?view=sql-server-ver16
export class JSON extends BaseTypes.JSON {
  // TODO: add constraint
  //  https://learn.microsoft.com/en-us/sql/t-sql/functions/isjson-transact-sql?view=sql-server-ver16

  parseDatabaseValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      throw new BaseError(
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

  toSql() {
    return 'NVARCHAR(MAX)';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  // TODO: add constraint

  toSql() {
    const minLength = maxBy(this.options.values, value => value.length)?.length ?? 0;

    // mssql does not have an ENUM type, we use NVARCHAR instead.
    // It is not possible to create an index on NVARCHAR(MAX), so we use 255 which should be plenty for everyone
    // but just in case, we also increase the length if the longest value is longer than 255 characters
    return `NVARCHAR(${Math.max(minLength, 255)})`;
  }
}
