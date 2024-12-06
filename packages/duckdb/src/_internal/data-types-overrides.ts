import type { AbstractDialect } from '@sequelize/core';
import { BaseError } from '@sequelize/core';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import type { AcceptedDate } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import NodeUtil from 'node:util';


export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql(): string {
    return 'BOOLEAN';
  }
}

export class STRING extends BaseTypes.STRING {
  toSql() {
    return 'VARCHAR';
  }
}

export class CHAR extends BaseTypes.CHAR {
  toSql() {
    return 'VARCHAR';
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

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
  }

  toSql(): string {
    if (this.options.length && this.options.length > 1) {
        return this.options.unsigned ? 'USMALLINT' :  'SMALLINT';
    }
    return this.options.unsigned? 'UTINYINT' : 'TINYINT';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
  }

  toSql(): string {
    if (this.options.length && this.options.length > 2) {
      return this.options.unsigned ? 'UINTEGER' :  'INTEGER';
    }
    return this.options.unsigned ? 'USMALLINT' :  'SMALLINT';
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
  }

  toSql(): string {
    return this.options.unsigned ? 'UINTEGER' :  'INTEGER';
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
  }

  toSql(): string {
    return this.options.unsigned ? 'UINTEGER' :  'INTEGER';
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
  }

  toSql(): string {
    return 'BIGINT';
  }

  parseDatabaseValue(value: BigInt): unknown {
    // Sequelize expects bigint to be represented as string
    return value.toString();
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
  }

  protected getNumberSqlTypeName(): string {
    return 'FLOAT';
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
  }

  protected getNumberSqlTypeName(): string {
    return 'DOUBLE';
  }
}

export class REAL extends BaseTypes.REAL {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
  }

  protected getNumberSqlTypeName(): string {
    return 'REAL';
  }
}

export class TIME extends BaseTypes.TIME {
  toSql(): string {
    return 'TIME';
  }
}

export class DATE extends BaseTypes.DATE {
  toSql(): string {
    return 'TIMESTAMPTZ';
  }

  toBindableValue(date: AcceptedDate) {
    // Z here means current timezone, _not_ UTC
    return this._applyTimezone(date).format('YYYY-MM-DD HH:mm:ss.SSSZ');
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  toSql(): string {
    return 'VARCHAR';
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

  toSql(): string {
    return 'JSON';
  }

  parseDatabaseValue(value: unknown): unknown {
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
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'UUID';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    const dialect = this._getDialect();

    return `ENUM(${this.options.values.map(value => dialect.escapeString(value)).join(', ')})`;
  }
}

export class DECIMAL extends BaseTypes.DECIMAL {}
