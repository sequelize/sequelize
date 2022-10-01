import maxBy from 'lodash/maxBy.js';
import { throwUnsupportedDataType } from '../abstract/data-types-utils.js';
import * as BaseTypes from '../abstract/data-types.js';
import type { ToSqlOptions } from '../abstract/data-types.js';
import type { AbstractDialect } from '../abstract/index.js';

function removeUnsupportedIntegerOptions(dataType: BaseTypes.BaseIntegerDataType, dialect: AbstractDialect) {
  if (dataType.options.length != null) {
    // this option only makes sense for zerofill
    dialect.warnDataTypeIssue(`${dialect.name} does not support ${dataType.getDataTypeId()} with length specified. This options is ignored.`);

    delete dataType.options.length;
  }
}

function removeUnsupportedFloatOptions(dataType: BaseTypes.BaseDecimalNumberDataType, dialect: AbstractDialect) {
  if (
    dataType.options.scale != null
    || dataType.options.precision != null
  ) {
    dialect.warnDataTypeIssue(`${dialect.name} does not support ${dataType.getDataTypeId()} with scale or precision specified. These options are ignored.`);

    delete dataType.options.scale;
    delete dataType.options.precision;
  }
}

export class BLOB extends BaseTypes.BLOB {
  toSql() {
    if (this.options.length != null) {
      if (this.options.length.toLowerCase() === 'tiny') { // tiny = 255 bytes
        return 'BLOB(255)';
      }

      if (this.options.length.toLowerCase() === 'medium') { // medium = 16M
        return 'BLOB(16M)';
      }

      if (this.options.length.toLowerCase() === 'long') { // long = 2GB
        return 'BLOB(2G)';
      }

      return `BLOB(${this.options.length})`;
    }

    return 'BLOB'; // 1MB
  }

  // escape(blob) {
  //   return `BLOB('${blob.toString().replace(/'/g, '\'\'')}')`;
  // }
  //
  // _stringify(value) {
  //   if (Buffer.isBuffer(value)) {
  //     return `BLOB('${value.toString().replace(/'/g, '\'\'')}')`;
  //   }
  //
  //   if (Array.isArray(value)) {
  //     value = Buffer.from(value);
  //   } else {
  //     value = Buffer.from(value.toString());
  //   }
  //
  //   const hex = value.toString('hex');
  //
  //   return this._hexify(hex);
  // }
  //
  // _hexify(hex) {
  //   return `x'${hex}'`;
  // }
}

export class STRING extends BaseTypes.STRING {
  toSql(options: ToSqlOptions) {
    const length = this.options.length ?? 255;

    if (this.options.binary) {
      if (length <= 4000) {
        return `VARCHAR(${length}) FOR BIT DATA`;
      }

      throw new Error(`${options.dialect.name} does not support the BINARY option for data types with a length greater than 4000.`);
    }

    if (length <= 4000) {
      return `VARCHAR(${length})`;
    }

    return `CLOB(${length})`;
  }
}

export class TEXT extends BaseTypes.TEXT {
  toSql() {
    // default value for CLOB
    let len = 2_147_483_647;
    if (typeof this.options.length === 'string') {
      switch (this.options.length.toLowerCase()) {
        // 'tiny', 'medium' and 'long' are MySQL values.
        // 'max' is dialect-dependant.
        case 'tiny':
          len = 2 ** 8;
          break;
        case 'medium':
          len = 2 ** 24;
          break;
        case 'long':
          len = 2 ** 32;
          break;
        case 'max':
          len = 2_147_483_647;
          break;
        default:
          throw new Error(`LENGTH value ${this.options.length} is not supported. Expected a number of one of the following strings: tiny, medium, long.`);
      }
    }

    if (len > 32_672) {
      return `CLOB(${len})`;
    }

    return `VARCHAR(${len})`;
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'CHAR(36) FOR BIT DATA';
  }
}

export class NOW extends BaseTypes.NOW {
  toSql() {
    return 'CURRENT TIME';
  }
}

export class DATE extends BaseTypes.DATE {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.precision != null && this.options.precision > 6) {
      this.options.precision = 6;
    }
  }

  toSql() {
    return `TIMESTAMP${this.options.precision != null ? `(${this.options.precision})` : ''}`;
  }

  // _stringify(date, options) {
  //   date = this._applyTimezone(date, options);
  //
  //   if (this._length > 0) {
  //     let msec = '.';
  //     for (let i = 0; i < this._length && i < 6; i++) {
  //       msec += 'S';
  //     }
  //
  //     return date.format(`YYYY-MM-DD HH:mm:ss${msec}`);
  //   }
  //
  //   return date.format('YYYY-MM-DD HH:mm:ss');
  // }

  // static parse(value) {
  //   if (typeof value !== 'string') {
  //     value = value.string();
  //   }
  //
  //   value = new Date(dayjs.utc(value));
  //
  //   return value;
  // }
}

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^8-1 check when the unsigned option is true
  // TODO: add >= -2^7 =< 2^7-1 check when the unsigned option is false

  toSql(): string {
    return 'SMALLINT';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^16-1 check when the unsigned option is true

  toSql(): string {
    if (this.options.unsigned) {
      return 'INTEGER';
    }

    return 'SMALLINT';
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

  toSql(): string {
    if (this.options.unsigned) {
      return 'BIGINT';
    }

    return 'INTEGER';
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.unsigned) {
      throwUnsupportedDataType(dialect, 'BIGINT.UNSIGNED');
    }

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

  // TODO: add check constraint >= 0 if unsigned is true

  getNumberSqlTypeName() {
    return 'REAL';
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedFloatOptions(this, dialect);
  }

  // TODO: add check constraint >= 0 if unsigned is true

  getNumberSqlTypeName() {
    return 'DOUBLE';
  }
}

export class DECIMAL extends BaseTypes.DECIMAL {
  // TODO: add check constraint >= 0 if unsigned is true
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    const minLength = maxBy(this.options.values, value => value.length)?.length ?? 0;

    // mssql does not have an ENUM type, we use NVARCHAR instead.
    // It is not possible to create an index on NVARCHAR(MAX), so we use 255 which should be plenty for everyone
    // but just in case, we also increase the length if the longest value is longer than 255 characters
    return `VARCHAR(${Math.max(minLength, 255)})`;
  }
}
