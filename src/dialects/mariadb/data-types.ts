'use strict';

import isEmpty from 'lodash/isEmpty';
import type { FieldInfo } from 'mariadb';
import moment from 'moment';
import momentTz from 'moment-timezone';
import wkx from 'wkx';
import { kSetDialectNames } from '../../dialect-toolbox';
import * as BaseTypes from '../abstract/data-types';
import type {
  AcceptableTypeOf,
  StringifyOptions,
} from '../abstract/data-types';

/**
 * types: [buffer_type, ...]
 *
 * @see documentation : https://mariadb.com/kb/en/library/resultset/#field-types
 * @see connector implementation : https://github.com/MariaDB/mariadb-connector-nodejs/blob/master/lib/const/field-type.js
 */

BaseTypes.DATE[kSetDialectNames]('mariadb', ['DATETIME']);
BaseTypes.STRING[kSetDialectNames]('mariadb', ['VAR_STRING']);
BaseTypes.CHAR[kSetDialectNames]('mariadb', ['STRING']);
BaseTypes.TEXT[kSetDialectNames]('mariadb', ['BLOB']);
BaseTypes.TINYINT[kSetDialectNames]('mariadb', ['TINY']);
BaseTypes.SMALLINT[kSetDialectNames]('mariadb', ['SHORT']);
BaseTypes.MEDIUMINT[kSetDialectNames]('mariadb', ['INT24']);
BaseTypes.INTEGER[kSetDialectNames]('mariadb', ['LONG']);
BaseTypes.BIGINT[kSetDialectNames]('mariadb', ['LONGLONG']);
BaseTypes.FLOAT[kSetDialectNames]('mariadb', ['FLOAT']);
BaseTypes.TIME[kSetDialectNames]('mariadb', ['TIME']);
BaseTypes.DATEONLY[kSetDialectNames]('mariadb', ['DATE']);
BaseTypes.BOOLEAN[kSetDialectNames]('mariadb', ['TINY']);
BaseTypes.BLOB[kSetDialectNames]('mariadb', ['TINYBLOB', 'BLOB', 'LONGBLOB']);
BaseTypes.DECIMAL[kSetDialectNames]('mariadb', ['NEWDECIMAL']);
BaseTypes.UUID[kSetDialectNames]('mariadb', false);
BaseTypes.ENUM[kSetDialectNames]('mariadb', false);
BaseTypes.REAL[kSetDialectNames]('mariadb', ['DOUBLE']);
BaseTypes.DOUBLE[kSetDialectNames]('mariadb', ['DOUBLE']);
BaseTypes.GEOMETRY[kSetDialectNames]('mariadb', ['GEOMETRY']);
BaseTypes.JSON[kSetDialectNames]('mariadb', ['JSON']);

export class DECIMAL extends BaseTypes.DECIMAL {
  toSql() {
    let definition = super.toSql();
    if (this._unsigned) {
      definition += ' UNSIGNED';
    }

    if (this._zerofill) {
      definition += ' ZEROFILL';
    }

    return definition;
  }
}

export class DATE extends BaseTypes.DATE {
  toSql() {
    return this._length ? `DATETIME(${this._length})` : 'DATETIME';
  }

  protected _stringify(
    date: AcceptableTypeOf<BaseTypes.DATE>,
    options: StringifyOptions,
  ) {
    if (!moment.isMoment(date)) {
      date = this._applyTimezone(date, options);
    }

    return date.format('YYYY-MM-DD HH:mm:ss.SSS');
  }

  static parse(value: FieldInfo, options: StringifyOptions) {
    const str = value.string();
    if (str === null) {
      return value;
    }

    if (options.timezone != null && momentTz.tz.zone(options.timezone)) {
      return momentTz.tz(value, options.timezone).toDate();
    }

    return new Date(`${value} ${options.timezone}`);
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  static parse(value: FieldInfo) {
    return value.string();
  }
}

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'CHAR(36) BINARY';
  }
}

export class GEOMETRY extends BaseTypes.GEOMETRY {
  readonly sqlType: string;

  constructor(...args: Parameters<typeof BaseTypes.GEOMETRY>) {
    super(...args);
    if (isEmpty(this.type)) {
      this.sqlType = this.key;
    } else {
      if (!this.type) {
        throw new Error('Expected GEOMETRY type');
      }

      this.sqlType = this.type;
    }
  }

  static parse(value: FieldInfo) {
    let buf = value.buffer();
    // Empty buffer, MySQL doesn't support POINT EMPTY
    // check, https://dev.mysql.com/worklog/task/?id=2381
    if (!buf || buf.length === 0) {
      return null;
    }

    // For some reason, discard the first 4 bytes
    buf = buf.slice(4);

    return wkx.Geometry.parse(buf).toGeoJSON({ shortCrs: true });
  }

  toSql() {
    return this.sqlType;
  }
}

export class ENUM<Member extends string> extends BaseTypes.ENUM<Member> {
  toSql(options: StringifyOptions) {
    return `ENUM(${this.values
      .map(value => options.escape(value))
      .join(', ')})`;
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
