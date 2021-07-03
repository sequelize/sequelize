'use strict';

const wkx = require('wkx');
const _ = require('lodash');
const moment = require('moment-timezone');
module.exports = BaseTypes => {
  BaseTypes.ABSTRACT.prototype.dialectTypes = 'https://dev.snowflake.com/doc/refman/5.7/en/data-types.html';

  /**
   * types: [buffer_type, ...]
   *
   * @see buffer_type here https://dev.snowflake.com/doc/refman/5.7/en/c-api-prepared-statement-type-codes.html
   * @see hex here https://github.com/sidorares/node-mysql2/blob/master/lib/constants/types.js
   */

  BaseTypes.DATE.types.snowflake = ['DATETIME'];
  BaseTypes.STRING.types.snowflake = ['VAR_STRING'];
  BaseTypes.CHAR.types.snowflake = ['STRING'];
  BaseTypes.TEXT.types.snowflake = ['BLOB'];
  BaseTypes.TINYINT.types.snowflake = ['TINY'];
  BaseTypes.SMALLINT.types.snowflake = ['SHORT'];
  BaseTypes.MEDIUMINT.types.snowflake = ['INT24'];
  BaseTypes.INTEGER.types.snowflake = ['LONG'];
  BaseTypes.BIGINT.types.snowflake = ['LONGLONG'];
  BaseTypes.FLOAT.types.snowflake = ['FLOAT'];
  BaseTypes.TIME.types.snowflake = ['TIME'];
  BaseTypes.DATEONLY.types.snowflake = ['DATE'];
  BaseTypes.BOOLEAN.types.snowflake = ['TINY'];
  BaseTypes.BLOB.types.snowflake = ['TINYBLOB', 'BLOB', 'LONGBLOB'];
  BaseTypes.DECIMAL.types.snowflake = ['NEWDECIMAL'];
  BaseTypes.UUID.types.snowflake = false;
  BaseTypes.ENUM.types.snowflake = false;
  BaseTypes.REAL.types.snowflake = ['DOUBLE'];
  BaseTypes.DOUBLE.types.snowflake = ['DOUBLE'];
  BaseTypes.GEOMETRY.types.snowflake = ['GEOMETRY'];
  BaseTypes.JSON.types.snowflake = ['JSON'];

  class DATE extends BaseTypes.DATE {
    toSql() {
      return 'TIMESTAMP';
    }
    _stringify(date, options) {
      date = this._applyTimezone(date, options);
      // Fractional DATETIMEs only supported on MySQL 5.6.4+
      if (this._length) {
        return date.format('YYYY-MM-DD HH:mm:ss.SSS');
      }
      return date.format('YYYY-MM-DD HH:mm:ss');
    }
    static parse(value, options) {
      value = value.string();
      if (value === null) {
        return value;
      }
      if (moment.tz.zone(options.timezone)) {
        value = moment.tz(value, options.timezone).toDate();
      }
      else {
        value = new Date(`${value} ${options.timezone}`);
      }
      return value;
    }
  }

  class DATEONLY extends BaseTypes.DATEONLY {
    static parse(value) {
      return value.string();
    }
  }
  class UUID extends BaseTypes.UUID {
    toSql() {
      // https://community.snowflake.com/s/question/0D50Z00009LH2fl/what-is-the-best-way-to-store-uuids
      return 'VARCHAR(36)';
    }
  }

  const SUPPORTED_GEOMETRY_TYPES = ['POINT', 'LINESTRING', 'POLYGON'];

  class GEOMETRY extends BaseTypes.GEOMETRY {
    constructor(type, srid) {
      super(type, srid);
      if (_.isEmpty(this.type)) {
        this.sqlType = this.key;
        return;
      }
      if (SUPPORTED_GEOMETRY_TYPES.includes(this.type)) {
        this.sqlType = this.type;
        return;
      }
      throw new Error(`Supported geometry types are: ${SUPPORTED_GEOMETRY_TYPES.join(', ')}`);
    }
    static parse(value) {
      value = value.buffer();
      // Empty buffer, MySQL doesn't support POINT EMPTY
      // check, https://dev.snowflake.com/worklog/task/?id=2381
      if (!value || value.length === 0) {
        return null;
      }
      // For some reason, discard the first 4 bytes
      value = value.slice(4);
      return wkx.Geometry.parse(value).toGeoJSON({ shortCrs: true });
    }
    toSql() {
      return 'GEOMETRY';
    }
  }

  class TEXT extends BaseTypes.TEXT {
    toSql() {
      return 'TEXT';
    }
  }

  class BOOLEAN extends BaseTypes.BOOLEAN {
    toSql() {
      return 'BOOLEAN';
    }
  }

  class ENUM extends BaseTypes.ENUM {
    toSql(options) {
      return `ENUM(${this.values.map(value => options.escape(value)).join(', ')})`;
    }
  }

  class JSONTYPE extends BaseTypes.JSON {
    _stringify(value, options) {
      return options.operation === 'where' && typeof value === 'string' ? value : JSON.stringify(value);
    }
  }

  return {
    TEXT,
    ENUM,
    DATE,
    BOOLEAN,
    DATEONLY,
    UUID,
    GEOMETRY,
    JSON: JSONTYPE
  };
};
