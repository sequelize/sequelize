import { kSetDialectNames } from '../../dialect-toolbox';
import type {
  DataType,
  StringifyOptions,
} from '../abstract/data-types';
import * as BaseTypes from '../abstract/data-types';

const warn = BaseTypes.ABSTRACT.warn.bind(
  undefined,
  'https://www.sqlite.org/datatype3.html',
);

/**
 * Removes unsupported SQLite options, i.e., UNSIGNED and ZEROFILL, for the integer data types.
 *
 * @param dataType The base integer data type.
 * @private
 */
function removeUnsupportedIntegerOptions(dataType: DataType) {
  if (
    Reflect.get(dataType, '_zerofill')
    || Reflect.get(dataType, '_unsigned')
  ) {
    warn(
      `SQLite does not support '${dataType.key}' with UNSIGNED or ZEROFILL. Plain '${dataType.key}' will be used instead.`,
    );
    Reflect.set(dataType, '_unsigned', undefined);
    Reflect.set(dataType, '_zerofill', undefined);
  }
}

/**
 * @see https://sqlite.org/datatype3.html
 */

BaseTypes.DATE[kSetDialectNames]('sqlite', ['DATETIME']);
BaseTypes.STRING[kSetDialectNames]('sqlite', ['VARCHAR', 'VARCHAR BINARY']);
BaseTypes.CHAR[kSetDialectNames]('sqlite', ['CHAR', 'CHAR BINARY']);
BaseTypes.TEXT[kSetDialectNames]('sqlite', ['TEXT']);
BaseTypes.TINYINT[kSetDialectNames]('sqlite', ['TINYINT']);
BaseTypes.SMALLINT[kSetDialectNames]('sqlite', ['SMALLINT']);
BaseTypes.MEDIUMINT[kSetDialectNames]('sqlite', ['MEDIUMINT']);
BaseTypes.INTEGER[kSetDialectNames]('sqlite', ['INTEGER']);
BaseTypes.BIGINT[kSetDialectNames]('sqlite', ['BIGINT']);
BaseTypes.FLOAT[kSetDialectNames]('sqlite', ['FLOAT']);
BaseTypes.TIME[kSetDialectNames]('sqlite', ['TIME']);
BaseTypes.DATEONLY[kSetDialectNames]('sqlite', ['DATE']);
BaseTypes.BOOLEAN[kSetDialectNames]('sqlite', ['TINYINT']);
BaseTypes.BLOB[kSetDialectNames]('sqlite', ['TINYBLOB', 'BLOB', 'LONGBLOB']);
BaseTypes.DECIMAL[kSetDialectNames]('sqlite', ['DECIMAL']);
BaseTypes.UUID[kSetDialectNames]('sqlite', ['UUID']);
BaseTypes.ENUM[kSetDialectNames]('sqlite', false);
BaseTypes.REAL[kSetDialectNames]('sqlite', ['REAL']);
BaseTypes.DOUBLE[kSetDialectNames]('sqlite', ['DOUBLE PRECISION']);
BaseTypes.GEOMETRY[kSetDialectNames]('sqlite', false);
BaseTypes.JSON[kSetDialectNames]('sqlite', ['JSON', 'JSONB']);

export class JSONTYPE extends BaseTypes.JSON {
  static parse(data: string) {
    return JSON.parse(data);
  }
}

export class DATE extends BaseTypes.DATE {
  static parse(date: string, options: StringifyOptions) {
    if (!date.includes('+') && options.timezone) {
      // For backwards compat. Dates inserted by sequelize < 2.0dev12 will not have a timestamp set
      return new Date(date + options.timezone);
    }

    return new Date(date); // We already have a timezone stored in the string
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  static parse(date: Date) {
    return date;
  }
}

export class STRING extends BaseTypes.STRING {
  toSql() {
    if (this._binary) {
      return `VARCHAR BINARY(${this._length})`;
    }

    return super.toSql();
  }
}

export class TEXT extends BaseTypes.TEXT {
  toSql() {
    if (this._length) {
      warn(
        'SQLite does not support TEXT with options. Plain `TEXT` will be used instead.',
      );
      this._length = undefined;
    }

    return 'TEXT';
  }
}

export class CITEXT extends BaseTypes.CITEXT {
  toSql() {
    return 'TEXT COLLATE NOCASE';
  }
}

export class CHAR extends BaseTypes.CHAR {
  toSql() {
    if (this._binary) {
      return `CHAR BINARY(${this._length})`;
    }

    return super.toSql();
  }
}

export class NUMBER extends BaseTypes.NUMBER {
  toSql() {
    let result = this.key;
    if (this._unsigned) {
      result += ' UNSIGNED';
    }

    if (this._zerofill) {
      result += ' ZEROFILL';
    }

    if (this._length) {
      result += `(${this._length}`;
      if (typeof this._decimals === 'number') {
        result += `,${this._decimals}`;
      }

      result += ')';
    }

    return result;
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  constructor(...args: Parameters<typeof BaseTypes.TINYINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

class SMALLINT extends BaseTypes.SMALLINT {
  constructor(...args: Parameters<typeof BaseTypes.SMALLINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

class MEDIUMINT extends BaseTypes.MEDIUMINT {
  constructor(...args: Parameters<typeof BaseTypes.MEDIUMINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

class INTEGER extends BaseTypes.INTEGER {
  constructor(...args: Parameters<typeof BaseTypes.INTEGER>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

class BIGINT extends BaseTypes.BIGINT {
  constructor(...args: Parameters<typeof BaseTypes.BIGINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

class FLOAT extends BaseTypes.FLOAT {
  static readonly key: string = 'FLOAT';

  static parse(value: string | number) {
    if (typeof value !== 'string') {
      return value;
    }

    if (value === 'NaN') {
      return Number.NaN;
    }

    if (value === 'Infinity') {
      return Number.POSITIVE_INFINITY;
    }

    if (value === '-Infinity') {
      return Number.NEGATIVE_INFINITY;
    }

    throw new Error(`Unable to parse float: ${value}`);
  }
}

class DOUBLE extends FLOAT {
  static readonly key = 'DOUBLE';
}

class REAL extends FLOAT {
  static readonly key = 'REAL';
}

for (const num of [
  FLOAT,
  DOUBLE,
  REAL,
  TINYINT,
  SMALLINT,
  MEDIUMINT,
  INTEGER,
  BIGINT,
]) {
  num.prototype.toSql = NUMBER.prototype.toSql;
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    return 'TEXT';
  }
}
