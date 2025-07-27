import type { AbstractDialect } from '@sequelize/core';
import type { AcceptedDate } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import maxBy from 'lodash/maxBy.js';

dayjs.extend(utc);

function removeUnsupportedIntegerOptions(
  dataType: BaseTypes.BaseIntegerDataType,
  dialect: AbstractDialect,
) {
  if (dataType.options.length != null) {
    // this option only makes sense for zerofill
    dialect.warnDataTypeIssue(
      `${dialect.name} does not support ${dataType.getDataTypeId()} with length specified. This options is ignored.`,
    );

    delete dataType.options.length;
  }
}

export class BLOB extends BaseTypes.BLOB {
  toSql() {
    if (this.options.length != null) {
      if (this.options.length.toLowerCase() === 'tiny') {
        // tiny = 255 bytes
        return 'BLOB(255)';
      }

      if (this.options.length.toLowerCase() === 'medium') {
        // medium = 16M
        return 'BLOB(16M)';
      }

      if (this.options.length.toLowerCase() === 'long') {
        // long = 2GB
        return 'BLOB(2G)';
      }

      return `BLOB(${this.options.length})`;
    }

    return 'BLOB(1M)';
  }
}

export class STRING extends BaseTypes.STRING {
  toSql() {
    const length = this.options.length ?? 255;

    if (this.options.binary) {
      if (length <= 4000) {
        return `VARCHAR(${length}) FOR BIT DATA`;
      }

      throw new Error(
        `${this._getDialect().name} does not support the BINARY option for data types with a length greater than 4000.`,
      );
    }

    if (length <= 4000) {
      return `VARCHAR(${length})`;
    }

    return `CLOB(${length})`;
  }
}

export class CHAR extends BaseTypes.CHAR {
  toSql() {
    if (this.options.binary) {
      return `CHAR(${this.options.length ?? 255}) FOR BIT DATA`;
    }

    return super.toSql();
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
          // long would normally be 2 ** 32, but that's above the limit for DB2
          len = 2_147_483_647;
          break;
        default:
          throw new Error(
            `LENGTH value ${this.options.length} is not supported. Expected a number of one of the following strings: tiny, medium, long.`,
          );
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

  toBindableValue(date: AcceptedDate) {
    date = dayjs(date).utc(false);

    return date.format('YYYY-MM-DD HH:mm:ss.SSS');
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
    removeUnsupportedIntegerOptions(this, dialect);
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  // TODO: add check constraint >= 0 if unsigned is true

  getNumberSqlTypeName() {
    return 'REAL';
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
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

    // db2 does not have an ENUM type, we use VARCHAR instead.
    return `VARCHAR(${Math.max(minLength, 255)})`;
  }
}
