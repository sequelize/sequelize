import NodeUtil from 'node:util';
import * as BaseTypes from '../abstract/data-types.js';
import type { BaseNumberDataType } from '../abstract/data-types.js';
import type { AbstractDialect } from '../abstract/index.js';

/**
 * Removes unsupported SQLite options, i.e., UNSIGNED and ZEROFILL, for the integer data types.
 *
 * @param dataType The base integer data type.
 * @param dialect
 */
function removeUnsupportedIntegerOptions(dataType: BaseNumberDataType, dialect: AbstractDialect) {
  if (dataType.options.zerofill || dataType.options.unsigned) {
    dialect.warnDataTypeIssue(`${dialect.name} does not support '${dataType.key}' with UNSIGNED or ZEROFILL. Plain '${dataType.key}' will be used instead.`);
    dataType.options.zerofill = undefined;
    dataType.options.unsigned = undefined;
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toBindableValue(value: boolean): unknown {
    return value ? '1' : '0';
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
      dialect.warnDataTypeIssue(`${dialect.name} does not support TEXT with options. Plain 'TEXT' will be used instead.`);
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
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }
}

export class INTEGER extends BaseTypes.INTEGER {
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

export class JSON extends BaseTypes.JSON {
  // TODO: add check constraint
  //  https://www.sqlite.org/json1.html#jvalid

  toBindableValue(value: any): string {
    return globalThis.JSON.stringify(value);
  }

  parseDatabaseValue(value: unknown): unknown {
    // sqlite3 being sqlite3, JSON numbers are returned as JS numbers, but everything else is returned as a JSON string
    if (typeof value === 'number') {
      return value;
    }

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
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    return 'TEXT';
  }
}
