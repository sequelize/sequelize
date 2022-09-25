import NodeUtil from 'node:util';
import maxBy from 'lodash/maxBy';
import type { Falsy } from '../../generic/falsy.js';
import * as BaseTypes from '../abstract/data-types.js';
import type { AbstractDialect } from '../abstract/index.js';

/**
 * Removes unsupported MSSQL options, i.e., LENGTH, UNSIGNED and ZEROFILL, for the integer data types.
 *
 * @param dataType The base integer data type.
 * @param dialect
 * @param opts
 * @param opts.allowUnsigned
 * @private
 */
function removeUnsupportedNumberOptions(
  dataType: BaseTypes.BaseNumberDataType,
  dialect: AbstractDialect,
  opts?: { allowUnsigned?: boolean },
) {
  if (!opts?.allowUnsigned && dataType.options.unsigned) {
    dialect.warnDataTypeIssue(`${dialect.name} does not support '${dataType.constructor.name}' with UNSIGNED. This option is ignored.`);

    delete dataType.options.unsigned;
  }

  if (
    dataType.options.zerofill
  ) {
    dialect.warnDataTypeIssue(`${dialect.name} does not support '${dataType.constructor.name}' with ZEROFILL. This options is ignored.`);

    delete dataType.options.zerofill;
  }
}

function removeUnsupportedIntegerOptions(
  dataType: BaseTypes.INTEGER,
  dialect: AbstractDialect,
  opts?: { allowUnsigned?: boolean },
) {
  removeUnsupportedNumberOptions(dataType, dialect, opts);

  if (
    dataType.options.length != null
  ) {
    dialect.warnDataTypeIssue(`${dialect.name} does not support '${dataType.constructor.name}' with length specified. This options is ignored.`);

    delete dataType.options.length;
  }
}

function removeUnsupportedFloatOptions(dataType: BaseTypes.BaseDecimalNumberDataType, dialect: AbstractDialect) {
  removeUnsupportedNumberOptions(dataType, dialect);

  if (
    dataType.options.scale != null
      || dataType.options.precision != null
  ) {
    dialect.warnDataTypeIssue(`${dialect.name} does not support '${dataType.constructor.name}' with scale or precision specified. These options are ignored.`);

    delete dataType.options.scale;
    delete dataType.options.precision;
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
      dialect.warnDataTypeIssue(`${dialect.name}: ${this.getDataTypeId()} cannot limit its size beyond length=tiny. This option is ignored, in favor of the highest size possible.`);
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
    if (!this.options.binary) {
      return `NVARCHAR(${this.options.length ?? 255})`;
    }

    return `VARBINARY(${this.options.length ?? 255})`;
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
      dialect.warnDataTypeIssue(`${dialect.name}: ${this.getDataTypeId()} cannot limit its size beyond length=tiny. This option is ignored, in favor of the highest size possible.`);
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
  escape(value: boolean | Falsy): string {
    return value ? '1' : '0';
  }

  toBindableValue(value: boolean | Falsy): unknown {
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

export class INTEGER extends BaseTypes.INTEGER {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedIntegerOptions(this, dialect);
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (!this.options.unsigned) {
      throw new Error(`${dialect.name} does not support the TINYINT data type (which is signed), but does support TINYINT.UNSIGNED.`);
    }

    removeUnsupportedIntegerOptions(this, dialect, { allowUnsigned: true });
  }

  toSql() {
    // tinyint is always unsigned in mssql
    return 'TINYINT';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedIntegerOptions(this, dialect);
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedIntegerOptions(this, dialect);
  }
}

export class REAL extends BaseTypes.REAL {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedFloatOptions(this, dialect);
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedFloatOptions(this, dialect);
  }

  protected getNumberSqlTypeName(): string {
    return 'REAL';
  }
}

export class DECIMAL extends BaseTypes.DECIMAL {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedNumberOptions(this, dialect);
  }
}

// https://learn.microsoft.com/en-us/sql/relational-databases/json/json-data-sql-server?view=sql-server-ver16
export class JSON extends BaseTypes.JSON {
  // TODO: add constraint
  //  https://learn.microsoft.com/en-us/sql/t-sql/functions/isjson-transact-sql?view=sql-server-ver16

  toBindableValue(value: any): string {
    return globalThis.JSON.stringify(value);
  }

  parseDatabaseValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      // eslint-disable-next-line unicorn/prefer-type-error
      throw new Error(`DataTypes.JSON received a non-string value from the database, which it cannot parse: ${NodeUtil.inspect(value)}.`);
    }

    try {
      return globalThis.JSON.parse(value);
    } catch (error) {
      throw new Error(`DataTypes.JSON received a value from the database that it not valid JSON: ${NodeUtil.inspect(value)}.`, { cause: error });
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
