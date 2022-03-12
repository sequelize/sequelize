import moment from 'moment';
import momentTz from 'moment-timezone';
import { kSetDialectNames } from '../../dialect-toolbox';
import * as BaseTypes from '../abstract/data-types';
import type {
  AcceptableTypeOf,
  StringifyOptions,
  BindParamOptions,
  RawTypeOf,
} from '../abstract/data-types';

const warn = BaseTypes.ABSTRACT.warn.bind(
  undefined,
  'https://www.ibm.com/support/knowledgecenter/SSEPGG_11.1.0/'
    + 'com.ibm.db2.luw.sql.ref.doc/doc/r0008478.html',
);

/**
 * Removes unsupported Db2 options, i.e., LENGTH, UNSIGNED and ZEROFILL,
 * for the integer data types.
 *
 * @param dataType The base integer data type.
 * @private
 */
function removeUnsupportedIntegerOptions(dataType: any) {
  if (
    dataType._length
    || dataType.options.length > 0
    || dataType._unsigned
    || dataType._zerofill
  ) {
    warn(
      `Db2 does not support '${dataType.key}' with options. Plain '${dataType.key}' will be used instead.`,
    );
    dataType._length = undefined;
    dataType.options.length = undefined;
    dataType._unsigned = undefined;
    dataType._zerofill = undefined;
  }
}

/**
 * types: [hex, ...]
 *
 * @see Data types and table columns: https://www.ibm.com/support/knowledgecenter/en/SSEPGG_11.1.0/com.ibm.db2.luw.admin.dbobj.doc/doc/c0055357.html
 */

BaseTypes.DATE[kSetDialectNames]('db2', ['TIMESTAMP']);
BaseTypes.STRING[kSetDialectNames]('db2', ['VARCHAR']);
BaseTypes.CHAR[kSetDialectNames]('db2', ['CHAR']);
BaseTypes.TEXT[kSetDialectNames]('db2', ['VARCHAR', 'CLOB']);
BaseTypes.TINYINT[kSetDialectNames]('db2', ['SMALLINT']);
BaseTypes.SMALLINT[kSetDialectNames]('db2', ['SMALLINT']);
BaseTypes.MEDIUMINT[kSetDialectNames]('db2', ['INTEGER']);
BaseTypes.INTEGER[kSetDialectNames]('db2', ['INTEGER']);
BaseTypes.BIGINT[kSetDialectNames]('db2', ['BIGINT']);
BaseTypes.FLOAT[kSetDialectNames]('db2', ['DOUBLE', 'REAL', 'FLOAT']);
BaseTypes.TIME[kSetDialectNames]('db2', ['TIME']);
BaseTypes.DATEONLY[kSetDialectNames]('db2', ['DATE']);
BaseTypes.BOOLEAN[kSetDialectNames]('db2', [
  'BOOLEAN',
  'BOOL',
  'SMALLINT',
  'BIT',
]);
BaseTypes.BLOB[kSetDialectNames]('db2', ['BLOB']);
BaseTypes.DECIMAL[kSetDialectNames]('db2', ['DECIMAL']);
BaseTypes.UUID[kSetDialectNames]('db2', ['CHAR () FOR BIT DATA']);
BaseTypes.ENUM[kSetDialectNames]('db2', ['VARCHAR']);
BaseTypes.REAL[kSetDialectNames]('db2', ['REAL']);
BaseTypes.DOUBLE[kSetDialectNames]('db2', ['DOUBLE']);
BaseTypes.GEOMETRY[kSetDialectNames]('db2', false);

export class BLOB extends BaseTypes.BLOB {
  toSql() {
    if (this._length) {
      if (this._length.toLowerCase() === 'tiny') {
        // tiny = 255 bytes
        return 'BLOB(255)';
      }

      if (this._length.toLowerCase() === 'medium') {
        // medium = 16M
        return 'BLOB(16M)';
      }

      if (this._length.toLowerCase() === 'long') {
        // long = 2GB
        return 'BLOB(2G)';
      }

      return `BLOB(${this._length})`;
    }

    return 'BLOB'; // 1MB
  }

  static escape(blob: AcceptableTypeOf<BaseTypes.BLOB>, options: StringifyOptions) {
    return `BLOB('${options.escape(blob.toString())}')`;
  }

  protected _stringify(value: AcceptableTypeOf<BaseTypes.BLOB>, options: StringifyOptions) {
    if (Buffer.isBuffer(value)) {
      return `BLOB('${options.escape(blob.toString())}')`;
    }

    if (Array.isArray(value)) {
      value = Buffer.from(value);
    } else {
      value = Buffer.from(value.toString());
    }

    const hex = value.toString('hex');

    return this._hexify(hex);
  }

  protected _hexify(hex: string) {
    return `x'${hex}'`;
  }
}

export class STRING extends BaseTypes.STRING {
  static readonly escape: false;

  toSql() {
    if (!this._binary) {
      if (this._length <= 4000) {
        return `VARCHAR(${this._length})`;
      }

      return `CLOB(${this._length})`;
    }

    if (this._length < 255) {
      return `CHAR(${this._length}) FOR BIT DATA`;
    }

    if (this._length <= 4000) {
      return `VARCHAR(${this._length}) FOR BIT DATA`;
    }

    return `BLOB(${this._length})`;
  }

  protected _hexify(hex: string) {
    return `x'${hex}'`;
  }

  protected _stringify(
    value: AcceptableTypeOf<BaseTypes.STRING>,
    options: StringifyOptions,
  ) {
    if (this._binary) {
      return this._hexify(value.toString('hex'));
    }

    return options.escape(value.toString());
  }

  protected _bindParam(
    value: AcceptableTypeOf<BaseTypes.STRING>,
    options: BindParamOptions,
  ) {
    return options.bindParam(this._binary ? Buffer.from(value) : value);
  }
}

export class TEXT extends BaseTypes.TEXT {
  // @ts-expect-error missing call to super() (useless here)
  constructor() {
    throw new Error('DB2 does not support the TEXT data-type');
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql() {
    return 'BOOLEAN';
  }

  protected _sanitize(value: RawTypeOf<BaseTypes.BOOLEAN>) {
    if (value !== null && value !== undefined) {
      if (Buffer.isBuffer(value) && value.length === 1) {
        // Bit fields are returned as buffers
        value = value[0];
      }

      if (typeof value === 'string') {
        // Only take action on valid boolean strings.
        value = value === 'true' ? true : value === 'false' ? false : value;
        value = value === '\u0001' ? true : value === '\u0000' ? false : value;
      } else if (typeof value === 'number') {
        // Only take action on valid boolean integers.
        value = value === 1 ? true : value === 0 ? false : value;
      }
    }

    return typeof value === 'boolean' ? value : null;
  }

  static readonly parse = this.prototype._sanitize;
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
  toSql() {
    if (this._length != null) {
      if (this._length < 0) {
        this._length = 0;
      }

      if (this._length > 6) {
        this._length = 6;
      }
    }

    return `TIMESTAMP${this._length ? `(${this._length})` : ''}`;
  }

  protected _stringify(
    date: AcceptableTypeOf<BaseTypes.DATE>,
    options: StringifyOptions,
  ) {
    if (!moment.isMoment(date)) {
      date = this._applyTimezone(date, options);
    }

    if (this._length != null && this._length > 0) {
      let msec = '.';
      for (let i = 0; i < this._length && i < 6; i++) {
        msec += 'S';
      }

      return date.format(`YYYY-MM-DD HH:mm:ss${msec}`);
    }

    return date.format('YYYY-MM-DD HH:mm:ss');
  }

  static parse(value: RawTypeOf<BaseTypes.DATE>) {
    if (typeof value !== 'string') {
      // @ts-expect-error what type is value?
      value = value.string();
    }

    if (value === null) {
      return value;
    }

    // @ts-expect-error what type is value?
    value = new Date(momentTz.utc(value));

    return value;
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  static parse(value: RawTypeOf<BaseTypes.DATEONLY>) {
    return momentTz(value).format('YYYY-MM-DD');
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  constructor(...args: ConstructorParameters<typeof BaseTypes.INTEGER>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  constructor(...args: ConstructorParameters<typeof BaseTypes.TINYINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  constructor(...args: ConstructorParameters<typeof BaseTypes.SMALLINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  constructor(...args: ConstructorParameters<typeof BaseTypes.BIGINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

export class REAL extends BaseTypes.REAL {
  constructor(...args: ConstructorParameters<typeof BaseTypes.REAL>) {
    super(...args);
    // Db2 does not support any options for real
    if (
      this._length
      || (this.options.length != null && this.options.length > 0)
      || this._unsigned
      || this._zerofill
    ) {
      warn(
        'Db2 does not support REAL with options. Plain `REAL` will be used instead.',
      );
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  constructor(...args: ConstructorParameters<typeof BaseTypes.FLOAT>) {
    super(...args);
    // Db2 does only support lengths as option.
    // Values between 1-24 result in 7 digits precision (4 bytes storage size)
    // Values between 25-53 result in 15 digits precision (8 bytes size)
    // If decimals are provided remove these and print a warning
    if (this._decimals) {
      warn(
        'Db2 does not support Float with decimals. Plain `FLOAT` will be used instead.',
      );
      this._length = undefined;
      this.options.length = undefined;
    }

    if (this._unsigned) {
      warn('Db2 does not support Float unsigned. `UNSIGNED` was removed.');
      this._unsigned = undefined;
    }

    if (this._zerofill) {
      warn('Db2 does not support Float zerofill. `ZEROFILL` was removed.');
      this._zerofill = undefined;
    }
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    return 'VARCHAR(255)';
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  constructor(...args: ConstructorParameters<typeof BaseTypes.DOUBLE>) {
    super(...args);
    // db2 does not support any parameters for double
    if (
      this._length
      || (this.options.length && this.options.length > 0)
      || this._unsigned
      || this._zerofill
    ) {
      warn(
        'db2 does not support DOUBLE with options. '
          + 'Plain DOUBLE will be used instead.',
      );
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }

  toSql() {
    return 'DOUBLE';
  }
}
