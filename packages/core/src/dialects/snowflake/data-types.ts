import maxBy from 'lodash/maxBy.js';
import * as BaseTypes from '../abstract/data-types.js';
import type { AcceptedDate, StringifyOptions } from '../abstract/data-types.js';
import type { AbstractDialect } from '../abstract/index.js';

export class DATE extends BaseTypes.DATE {
  toSql() {
    return `TIMESTAMP${this.options.precision != null ? `(${this.options.precision})` : ''}`;
  }

  toBindableValue(date: AcceptedDate, options: StringifyOptions) {
    date = this._applyTimezone(date, options);

    return date.format('YYYY-MM-DD HH:mm:ss.SSS');
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    // https://community.snowflake.com/s/question/0D50Z00009LH2fl/what-is-the-best-way-to-store-uuids
    return 'VARCHAR(36)';
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    const minLength = maxBy(this.options.values, value => value.length)?.length ?? 0;

    // db2 does not have an ENUM type, we use VARCHAR instead.
    return `VARCHAR(${Math.max(minLength, 255)})`;
  }
}

export class TEXT extends BaseTypes.TEXT {
  toSql() {
    return 'TEXT';
  }
}

export class JSON extends BaseTypes.JSON {
  escape(value: unknown, options: StringifyOptions) {
    return options.operation === 'where' && typeof value === 'string' ? value : globalThis.JSON.stringify(value);
  }
}

/** @deprecated */
export class REAL extends BaseTypes.REAL {
  toSql(): string {
    return 'REAL';
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  // TODO: warn that FLOAT is not supported in Snowflake, only DOUBLE is

  toSql(): string {
    return 'FLOAT';
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  toSql(): string {
    // FLOAT is a double-precision floating point in Snowflake
    return 'FLOAT';
  }
}

// Snowflake only has one int type: Integer, which is -99999999999999999999999999999999999999 to 99999999999999999999999999999999999999
export class TINYINT extends BaseTypes.TINYINT {
  toSql() {
    return 'INTEGER';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  toSql() {
    return 'INTEGER';
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  toSql() {
    return 'INTEGER';
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  toSql() {
    return 'INTEGER';
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  // not really true, but snowflake allows INT values up to 99999999999999999999999999999999999999,
  // which is more than enough to cover a 64-bit unsigned integer (0 - 18446744073709551615)
  protected _supportsNativeUnsigned(_dialect: AbstractDialect): boolean {
    return true;
  }

  toSql() {
    return 'INTEGER';
  }
}
