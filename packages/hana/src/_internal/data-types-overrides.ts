import NodeUtil from 'node:util';
import maxBy from 'lodash/maxBy.js';
import type { AbstractDialect } from '@sequelize/core';
import type { AcceptedDate } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import { BaseError } from '@sequelize/core';

function removeUnsupportedIntegerOptions(dataType: BaseTypes.BaseIntegerDataType, dialect: AbstractDialect) {
  if (dataType.options.length != null) {
    // this option only makes sense for zerofill
    dialect.warnDataTypeIssue(`${dialect.name} does not support ${dataType.getDataTypeId()} with length specified. This options is ignored.`);

    delete dataType.options.length;
  }
}

export class STRING extends BaseTypes.STRING {
  toSql() {
    return `NVARCHAR(${this.options.length ?? 255})`;
  }
}

export class TEXT extends BaseTypes.TEXT {
  toSql() {
    if (this.options.length && this.options.length.toLowerCase() === 'tiny') {
      return 'NVARCHAR(256)';
    }

    return 'NCLOB';
  }
}

export class CHAR extends BaseTypes.CHAR {
  toSql() {
    return `NCHAR(${this.options.length ?? 255})`;
  }
}

export class DATE extends BaseTypes.DATE {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.precision) {
      dialect.warnDataTypeIssue(
        `${dialect.name} does not support DATE with options. Plain DATE will be used instead.`,
      );

      this.options.precision = undefined;
    }
  }

  toSql() {
    return 'TIMESTAMP';
  }

  toBindableValue(date: AcceptedDate) {
    date = this._applyTimezone(date);

    return date.format('YYYY-MM-DD HH:mm:ss.SSS');
  }
}

export class NOW extends BaseTypes.NOW {
  toSql() {
    return 'CURRENT_DATE';
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  toSql(): string {
    if (this.options.unsigned) {
      return 'TINYINT';
    }

    return 'SMALLINT';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  toSql(): string {
    if (this.options.unsigned) {
      return 'INTEGER';
    }

    return 'SMALLINT';
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  toSql(): string {
    return 'INTEGER';
  }
}

export class INTEGER extends BaseTypes.INTEGER {
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

export class DOUBLE extends BaseTypes.DOUBLE {
  // TODO: add check constraint >= 0 if unsigned is true

  getNumberSqlTypeName() {
    return 'DOUBLE';
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  // TODO: add check constraint >= 0 if unsigned is true

  protected getNumberSqlTypeName(): string {
    // The REAL data type specifies a single-precision, 32-bit floating-point number.
    // The FLOAT(<n>) data type specifies a 32-bit or 64-bit real number, where <n> specifies the number of significant bits and can range between 1 and 53.
    // https://help.sap.com/docs/hana-cloud-database/sap-hana-cloud-sap-hana-database-sql-reference-guide/numeric-data-types
    return 'REAL';
  }
}

export class BLOB extends BaseTypes.BLOB {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.length) {
      dialect.warnDataTypeIssue(`${dialect.name} does not support '${this.getDataTypeId()}' with length. This option will be ignored.`);
      delete this.options.length;
    }
  }

  toSql() {
    return 'BLOB';
  }
}


export class JSON extends BaseTypes.JSON {
  parseDatabaseValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      throw new BaseError(`DataTypes.JSON received a non-string value from the database, which it cannot parse: ${NodeUtil.inspect(value)}.`);
    }

    try {
      return globalThis.JSON.parse(value);
    } catch (error) {
      throw new BaseError(`DataTypes.JSON received a value from the database that it not valid JSON: ${NodeUtil.inspect(value)}.`, { cause: error });
    }
  }

  toSql() {
    return 'NCLOB';
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'VARCHAR(36)';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    const maxLength = maxBy(this.options.values, value => value.length)?.length ?? 0;

    // hana does not have an ENUM type, we use NVARCHAR instead.
    // It is not possible to create an index on NVARCHAR(MAX), so we use 255 which should be plenty for everyone
    // but just in case, we also increase the length if the longest value is longer than 255 characters
    return `NVARCHAR(${Math.max(maxLength, 255)})`;
  }
}
