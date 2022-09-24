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
}

export class NOW extends BaseTypes.NOW {
  toSql() {
    return 'GETDATE()';
  }
}

export class DATE extends BaseTypes.DATE {
  toSql() {
    return 'DATETIMEOFFSET';
  }
}

// export class DATEONLY extends BaseTypes.DATEONLY {
//   parse(value) {
//     // TODO
//     return dayjs(value).format('YYYY-MM-DD');
//   }
// }

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
