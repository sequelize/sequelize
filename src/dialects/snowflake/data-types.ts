'use strict';

import moment from 'moment';
import { kSetDialectNames } from '../../dialect-toolbox';
import * as BaseTypes from '../abstract/data-types';
import type {
  AcceptableTypeOf,
  StringifyOptions,
} from '../abstract/data-types';

// TODO [>6]: Why are we changing abstract data-types???
BaseTypes.ABSTRACT.prototype.dialectTypes
  = 'https://dev.snowflake.com/doc/refman/5.7/en/data-types.html';

/**
 * types: [buffer_type, ...]
 *
 * @see buffer_type here https://dev.snowflake.com/doc/refman/5.7/en/c-api-prepared-statement-type-codes.html
 * @see hex here https://github.com/sidorares/node-mysql2/blob/master/lib/constants/types.js
 */

BaseTypes.DATE[kSetDialectNames]('snowflake', ['DATETIME']);
BaseTypes.STRING[kSetDialectNames]('snowflake', ['VAR_STRING']);
BaseTypes.CHAR[kSetDialectNames]('snowflake', ['STRING']);
BaseTypes.TEXT[kSetDialectNames]('snowflake', ['BLOB']);
BaseTypes.TINYINT[kSetDialectNames]('snowflake', ['TINY']);
BaseTypes.SMALLINT[kSetDialectNames]('snowflake', ['SHORT']);
BaseTypes.MEDIUMINT[kSetDialectNames]('snowflake', ['INT24']);
BaseTypes.INTEGER[kSetDialectNames]('snowflake', ['LONG']);
BaseTypes.BIGINT[kSetDialectNames]('snowflake', ['LONGLONG']);
BaseTypes.FLOAT[kSetDialectNames]('snowflake', ['FLOAT']);
BaseTypes.TIME[kSetDialectNames]('snowflake', ['TIME']);
BaseTypes.DATEONLY[kSetDialectNames]('snowflake', ['DATE']);
BaseTypes.BOOLEAN[kSetDialectNames]('snowflake', ['TINY']);
BaseTypes.BLOB[kSetDialectNames]('snowflake', ['TINYBLOB', 'BLOB', 'LONGBLOB']);
BaseTypes.DECIMAL[kSetDialectNames]('snowflake', ['NEWDECIMAL']);
BaseTypes.UUID[kSetDialectNames]('snowflake', false);
// Enum is not supported
// https://docs.snowflake.com/en/sql-reference/data-types-unsupported.html
BaseTypes.ENUM[kSetDialectNames]('snowflake', false);
BaseTypes.REAL[kSetDialectNames]('snowflake', ['DOUBLE']);
BaseTypes.DOUBLE[kSetDialectNames]('snowflake', ['DOUBLE']);
BaseTypes.GEOMETRY[kSetDialectNames]('snowflake', ['GEOMETRY']);
BaseTypes.JSON[kSetDialectNames]('snowflake', ['JSON']);

export class DATE extends BaseTypes.DATE {
  toSql() {
    return 'TIMESTAMP';
  }

  protected _stringify(
    date: AcceptableTypeOf<BaseTypes.DATE>,
    options: StringifyOptions,
  ) {
    if (!moment.isMoment(date)) {
      date = this._applyTimezone(date, options);
    }

    if (this._length) {
      return date.format('YYYY-MM-DD HH:mm:ss.SSS');
    }

    return date.format('YYYY-MM-DD HH:mm:ss');
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {}

export class UUID extends BaseTypes.UUID {
  toSql() {
    // https://community.snowflake.com/s/question/0D50Z00009LH2fl/what-is-the-best-way-to-store-uuids
    return 'VARCHAR(36)';
  }
}

export class TEXT extends BaseTypes.TEXT {
  toSql() {
    return 'TEXT';
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql() {
    return 'BOOLEAN';
  }
}

class JSONTYPE extends BaseTypes.JSON {
  protected _stringify(
    value: AcceptableTypeOf<BaseTypes.JSON>,
    options: StringifyOptions,
  ) {
    return options.operation === 'where' && typeof value === 'string'
      ? value
      : JSON.stringify(value);
  }
}

export { JSONTYPE as JSON };
