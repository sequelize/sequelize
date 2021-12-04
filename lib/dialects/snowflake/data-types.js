'use strict';

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
  // Enum is not supported
  // https://docs.snowflake.com/en/sql-reference/data-types-unsupported.html
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

  class JSONTYPE extends BaseTypes.JSON {
    _stringify(value, options) {
      return options.operation === 'where' && typeof value === 'string' ? value : JSON.stringify(value);
    }
  }

  return {
    TEXT,
    DATE,
    BOOLEAN,
    DATEONLY,
    UUID,
    JSON: JSONTYPE
  };
};
