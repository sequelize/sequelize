import dayjs from 'dayjs';
import type { Falsy } from '../../generic/falsy.js';
import { createDataTypesWarn } from '../abstract/data-types-utils.js';
import * as BaseTypes from '../abstract/data-types.js';
import type { AbstractDialect } from '../abstract/index.js';

const warn = createDataTypesWarn('https://msdn.microsoft.com/en-us/library/ms187752%28v=sql.110%29.aspx');

/**
 * Removes unsupported MSSQL options, i.e., LENGTH, UNSIGNED and ZEROFILL, for the integer data types.
 *
 * @param dataType The base integer data type.
 * @param opts
 * @param opts.allowUnsigned
 * @private
 */
function removeUnsupportedNumberOptions(dataType: BaseTypes.BaseNumberDataType, opts?: { allowUnsigned?: boolean }) {
  if (!opts?.allowUnsigned && dataType.options.unsigned) {
    warn(`MSSQL does not support '${dataType.constructor.name}' with UNSIGNED. This option is ignored.`);

    delete dataType.options.unsigned;
  }

  if (
    dataType.options.zerofill
  ) {
    warn(`MSSQL does not support '${dataType.constructor.name}' with ZEROFILL. This options is ignored.`);

    delete dataType.options.zerofill;
  }
}

function removeUnsupportedIntegerOptions(dataType: BaseTypes.INTEGER, opts?: { allowUnsigned?: boolean }) {
  removeUnsupportedNumberOptions(dataType, opts);

  if (
    dataType.options.length != null
  ) {
    warn(`MSSQL does not support '${dataType.constructor.name}' with length specified. This options is ignored.`);

    delete dataType.options.length;
  }
}

function removeUnsupportedFloatOptions(dataType: BaseTypes.BaseDecimalNumberDataType) {
  removeUnsupportedNumberOptions(dataType);

  if (
    dataType.options.scale != null
      || dataType.options.precision != null
  ) {
    warn(`MSSQL does not support '${dataType.constructor.name}' with scale or precision specified. These options are ignored.`);

    delete dataType.options.scale;
    delete dataType.options.precision;
  }
}

export class BLOB extends BaseTypes.BLOB {
  toSql() {
    if (this.options.length) {
      if (this.options.length.toLowerCase() === 'tiny') { // tiny = 2^8
        warn('MSSQL does not support BLOB with the `length` = `tiny` option. `VARBINARY(256)` will be used instead.');

        return 'VARBINARY(256)';
      }

      warn('MSSQL does not support BLOB with the `length` option. `VARBINARY(MAX)` will be used instead.');
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
  toSql() {
    // TEXT is deprecated in mssql and it would normally be saved as a non-unicode string.
    // Using unicode is just future proof
    if (this.options.length) {
      if (this.options.length.toLowerCase() === 'tiny') { // tiny = 2^8
        warn('MSSQL does not support TEXT with the `length` = `tiny` option. `NVARCHAR(256)` will be used instead.');

        return 'NVARCHAR(256)';
      }

      warn('MSSQL does not support TEXT with the `length` option. `NVARCHAR(MAX)` will be used instead.');
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

  parse(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    // unify with other dialects by forcing lowercase on UUID strings.
    return value.toLowerCase();
  }
}

export class NOW extends BaseTypes.NOW {
  toSql() {
    return 'GETDATE()';
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  parse(value: unknown): unknown {
    if (value instanceof Date) {
      return dayjs.utc(value).format('YYYY-MM-DD');
    }

    return value;
  }
}

export class TIME extends BaseTypes.TIME {
  parse(value: unknown): unknown {
    if (value instanceof Date) {
      // We lose precision past the millisecond because Tedious pre-parses the value.
      // This could be fixed by https://github.com/tediousjs/tedious/issues/678
      return dayjs.utc(value).format('HH:mm:ss.SSS');
    }

    return value;
  }
}

export class DATE extends BaseTypes.DATE {
  toSql() {
    if (this.options.precision != null) {
      return `DATETIMEOFFSET(${this.options.precision})`;
    }

    return 'DATETIMEOFFSET';
  }

  parse(value: unknown): unknown {
    if (value instanceof Date) {
      // Tedious pre-parses the value as a Date, but we want
      // to provide a string in raw queries and let the user decide on which date library to use.
      // As a result, Tedious parses the date, then we serialize it, then our Date data type parses it again.
      // This is inefficient but could be fixed by https://github.com/tediousjs/tedious/issues/678
      // We also lose precision past the millisecond because Tedious pre-parses the value.
      return dayjs.utc(value).format('YYYY-MM-DD HH:mm:ss.SSS+00');
    }

    return value;
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedIntegerOptions(this);
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (!this.options.unsigned) {
      throw new Error(`${dialect.name} does not support the TINYINT data type (which is signed), but does support TINYINT.UNSIGNED.`);
    }

    removeUnsupportedIntegerOptions(this, { allowUnsigned: true });
  }

  toSql() {
    // tinyint is always unsigned in mssql
    return 'TINYINT';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedIntegerOptions(this);
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedIntegerOptions(this);
  }
}

export class REAL extends BaseTypes.REAL {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedFloatOptions(this);
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedFloatOptions(this);
  }

  protected getNumberSqlTypeName(): string {
    return 'REAL';
  }
}

export class DECIMAL extends BaseTypes.DECIMAL {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    removeUnsupportedNumberOptions(this);
  }

  parse(value: unknown): unknown {
    // Tedious returns DECIMAL as a JS number, which is not an appropriate type for a decimal.
    return String(value);
  }
}

// https://learn.microsoft.com/en-us/sql/relational-databases/json/json-data-sql-server?view=sql-server-ver16
export class JSON extends BaseTypes.JSON {
  // TODO: add constraint
  //  https://learn.microsoft.com/en-us/sql/t-sql/functions/isjson-transact-sql?view=sql-server-ver16

  toSql() {
    return 'NVARCHAR(MAX)';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  // TODO: add constraint

  toSql() {
    return 'NVARCHAR(MAX)';
  }
}
