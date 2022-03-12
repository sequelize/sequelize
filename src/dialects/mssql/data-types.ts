'use strict';

import moment from 'moment';
import { kSetDialectNames } from '../../dialect-toolbox';
import type {
  AcceptableTypeOf,
  RawTypeOf,
  StringifyOptions,
  DataType,
  BindParamOptions,
} from '../abstract/data-types';
import * as BaseTypes from '../abstract/data-types';

const warn = BaseTypes.ABSTRACT.warn.bind(
  undefined,
  'https://msdn.microsoft.com/en-us/library/ms187752%28v=sql.110%29.aspx',
);

/**
 * Removes unsupported MSSQL options, i.e., LENGTH, UNSIGNED and ZEROFILL, for the integer data types.
 *
 * @param dataType The base integer data type.
 * @private
 */
function removeUnsupportedIntegerOptions(dataType: DataType) {
  if (
    Reflect.get(dataType, '_length')
    || Reflect.get(dataType, 'options'.length) > 0
    || Reflect.get(dataType, '_unsigned')
    || Reflect.get(dataType, '_zerofill')
  ) {
    warn(
      `MSSQL does not support '${dataType.key}' with options. Plain '${dataType.key}' will be used instead.`,
    );
    Reflect.set(dataType, '_length', undefined);
    Reflect.get(dataType, 'options').length = undefined;
    Reflect.set(dataType, '_unsigned', undefined);
    Reflect.set(dataType, '_zerofill', undefined);
  }
}

/**
 * types: [hex, ...]
 *
 * @see hex here https://github.com/tediousjs/tedious/blob/master/src/data-type.ts
 */

BaseTypes.DATE[kSetDialectNames]('mssql', [43]);
BaseTypes.STRING[kSetDialectNames]('mssql', [231, 173]);
BaseTypes.CHAR[kSetDialectNames]('mssql', [175]);
BaseTypes.TEXT[kSetDialectNames]('mssql', false);
// https://msdn.microsoft.com/en-us/library/ms187745(v=sql.110).aspx
BaseTypes.TINYINT[kSetDialectNames]('mssql', [30]);
BaseTypes.SMALLINT[kSetDialectNames]('mssql', [34]);
BaseTypes.MEDIUMINT[kSetDialectNames]('mssql', false);
BaseTypes.INTEGER[kSetDialectNames]('mssql', [38]);
BaseTypes.BIGINT[kSetDialectNames]('mssql', false);
BaseTypes.FLOAT[kSetDialectNames]('mssql', [109]);
BaseTypes.TIME[kSetDialectNames]('mssql', [41]);
BaseTypes.DATEONLY[kSetDialectNames]('mssql', [40]);
BaseTypes.BOOLEAN[kSetDialectNames]('mssql', [104]);
BaseTypes.BLOB[kSetDialectNames]('mssql', [165]);
BaseTypes.DECIMAL[kSetDialectNames]('mssql', [106]);
BaseTypes.UUID[kSetDialectNames]('mssql', false);
BaseTypes.ENUM[kSetDialectNames]('mssql', false);
BaseTypes.REAL[kSetDialectNames]('mssql', [109]);
BaseTypes.DOUBLE[kSetDialectNames]('mssql', [109]);
// BaseTypes.GEOMETRY.types.mssql = [240]; // not yet supported
BaseTypes.GEOMETRY.types.mssql = false;

export class BLOB extends BaseTypes.BLOB {
  toSql() {
    if (this._length) {
      if (this._length.toLowerCase() === 'tiny') {
        // tiny = 2^8
        warn(
          'MSSQL does not support BLOB with the `length` = `tiny` option. `VARBINARY(256)` will be used instead.',
        );

        return 'VARBINARY(256)';
      }

      warn(
        'MSSQL does not support BLOB with the `length` option. `VARBINARY(MAX)` will be used instead.',
      );
    }

    return 'VARBINARY(MAX)';
  }

  protected _hexify(hex: string) {
    return `0x${hex}`;
  }
}

export class STRING extends BaseTypes.STRING {
  static readonly escape = false;

  toSql() {
    if (!this._binary) {
      return `NVARCHAR(${this._length})`;
    }

    return `BINARY(${this._length})`;
  }

  protected _stringify(
    value: AcceptableTypeOf<BaseTypes.STRING>,
    options: StringifyOptions,
  ) {
    if (this._binary) {
      const buf
        = typeof value === 'string' ? Buffer.from(value, 'binary') : value;

      const hex = buf.toString('hex');

      return `0x${hex}`;
    }

    return options.escape(
      typeof value === 'string' ? value : value.toString('binary'),
    );
  }

  protected _bindParam(
    value: AcceptableTypeOf<BaseTypes.STRING>,
    options: BindParamOptions,
  ) {
    return options.bindParam(this._binary ? Buffer.from(value) : value);
  }
}

export class TEXT extends BaseTypes.TEXT {
  toSql() {
    // TEXT is deprecated in mssql and it would normally be saved as a non-unicode string.
    // Using unicode is just future proof
    if (this._length) {
      if (this._length.toLowerCase() === 'tiny') {
        // tiny = 2^8
        warn(
          'MSSQL does not support TEXT with the `length` = `tiny` option. `NVARCHAR(256)` will be used instead.',
        );

        return 'NVARCHAR(256)';
      }

      warn(
        'MSSQL does not support TEXT with the `length` option. `NVARCHAR(MAX)` will be used instead.',
      );
    }

    return 'NVARCHAR(MAX)';
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql() {
    return 'BIT';
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'CHAR(36)';
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

export class DATEONLY extends BaseTypes.DATEONLY {
  static parse(value: RawTypeOf<BaseTypes.DATEONLY>) {
    return moment(value).format('YYYY-MM-DD');
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  constructor(...args: Parameters<typeof BaseTypes.INTEGER>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  constructor(...args: Parameters<typeof BaseTypes.TINYINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  constructor(...args: Parameters<typeof BaseTypes.SMALLINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  constructor(...args: Parameters<typeof BaseTypes.BIGINT>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

export class REAL extends BaseTypes.REAL {
  constructor(...args: Parameters<typeof BaseTypes.REAL>) {
    super(...args);

    // MSSQL does not support any options for real
    if (
      this._length
      || (this.options?.length != null && this.options?.length > 0)
      || this._unsigned
      || this._zerofill
    ) {
      warn(
        'MSSQL does not support REAL with options. Plain `REAL` will be used instead.',
      );
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  constructor(...args: Parameters<typeof BaseTypes.FLOAT>) {
    super(...args);
    // MSSQL does only support lengths as option.
    // Values between 1-24 result in 7 digits precision (4 bytes storage size)
    // Values between 25-53 result in 15 digits precision (8 bytes storage size)
    // If decimals are provided remove these and print a warning
    if (this._decimals) {
      warn(
        'MSSQL does not support Float with decimals. Plain `FLOAT` will be used instead.',
      );
      this._length = undefined;
      this.options.length = undefined;
    }

    if (this._unsigned) {
      warn('MSSQL does not support Float unsigned. `UNSIGNED` was removed.');
      this._unsigned = undefined;
    }

    if (this._zerofill) {
      warn('MSSQL does not support Float zerofill. `ZEROFILL` was removed.');
      this._zerofill = undefined;
    }
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql() {
    return 'VARCHAR(255)';
  }
}
