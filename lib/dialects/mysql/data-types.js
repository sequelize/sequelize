'use strict';

const wkx = require('wkx');
const _ = require('lodash');
const moment = require('moment-timezone');
const inherits = require('../../utils/inherits');

module.exports = BaseTypes => {
  BaseTypes.ABSTRACT.prototype.dialectTypes = 'https://dev.mysql.com/doc/refman/5.7/en/data-types.html';

  /**
   * types: [buffer_type, ...]
   * @see buffer_type here https://dev.mysql.com/doc/refman/5.7/en/c-api-prepared-statement-type-codes.html
   * @see hex here https://github.com/sidorares/node-mysql2/blob/master/lib/constants/types.js
   */

  BaseTypes.DATE.types.mysql = ['DATETIME'];
  BaseTypes.STRING.types.mysql = ['VAR_STRING'];
  BaseTypes.CHAR.types.mysql = ['STRING'];
  BaseTypes.TEXT.types.mysql = ['BLOB'];
  BaseTypes.TINYINT.types.mysql = ['TINY'];
  BaseTypes.SMALLINT.types.mysql = ['SHORT'];
  BaseTypes.MEDIUMINT.types.mysql = ['INT24'];
  BaseTypes.INTEGER.types.mysql = ['LONG'];
  BaseTypes.BIGINT.types.mysql = ['LONGLONG'];
  BaseTypes.FLOAT.types.mysql = ['FLOAT'];
  BaseTypes.TIME.types.mysql = ['TIME'];
  BaseTypes.DATEONLY.types.mysql = ['DATE'];
  BaseTypes.BOOLEAN.types.mysql = ['TINY'];
  BaseTypes.BLOB.types.mysql = ['TINYBLOB', 'BLOB', 'LONGBLOB'];
  BaseTypes.DECIMAL.types.mysql = ['NEWDECIMAL'];
  BaseTypes.UUID.types.mysql = false;
  BaseTypes.ENUM.types.mysql = false;
  BaseTypes.REAL.types.mysql = ['DOUBLE'];
  BaseTypes.DOUBLE.types.mysql = ['DOUBLE'];
  BaseTypes.GEOMETRY.types.mysql = ['GEOMETRY'];
  BaseTypes.JSON.types.mysql = ['JSON'];

  function BLOB(length) {
    if (!(this instanceof BLOB)) return new BLOB(length);
    BaseTypes.BLOB.apply(this, arguments);
  }
  inherits(BLOB, BaseTypes.BLOB);

  BLOB.parse = function(value, options, next) {
    const data = next();

    if (Buffer.isBuffer(data) && data.length === 0) {
      return null;
    }

    return data;
  };

  function DECIMAL(precision, scale) {
    if (!(this instanceof DECIMAL)) return new DECIMAL(precision, scale);
    BaseTypes.DECIMAL.apply(this, arguments);
  }
  inherits(DECIMAL, BaseTypes.DECIMAL);

  DECIMAL.prototype.toSql = function toSql() {
    let definition = BaseTypes.DECIMAL.prototype.toSql.apply(this);

    if (this._unsigned) {
      definition += ' UNSIGNED';
    }

    if (this._zerofill) {
      definition += ' ZEROFILL';
    }

    return definition;
  };

  function DATE(length) {
    if (!(this instanceof DATE)) return new DATE(length);
    BaseTypes.DATE.apply(this, arguments);
  }
  inherits(DATE, BaseTypes.DATE);

  DATE.prototype.toSql = function toSql() {
    return 'DATETIME' + (this._length ? '(' + this._length + ')' : '');
  };

  DATE.prototype._stringify = function _stringify(date, options) {
    date = BaseTypes.DATE.prototype._applyTimezone(date, options);
    // Fractional DATETIMEs only supported on MySQL 5.6.4+
    if (this._length) {
      return date.format('YYYY-MM-DD HH:mm:ss.SSS');
    }

    return date.format('YYYY-MM-DD HH:mm:ss');
  };

  DATE.parse = function parse(value, options) {
    value = value.string();

    if (value === null) {
      return value;
    }

    if (moment.tz.zone(options.timezone)) {
      value = moment.tz(value, options.timezone).toDate();
    } else {
      value = new Date(value + ' ' + options.timezone);
    }

    return value;
  };

  function DATEONLY() {
    if (!(this instanceof DATEONLY)) return new DATEONLY();
    BaseTypes.DATEONLY.apply(this, arguments);
  }
  inherits(DATEONLY, BaseTypes.DATEONLY);

  DATEONLY.parse = function parse(value) {
    return value.string();
  };

  function UUID() {
    if (!(this instanceof UUID)) return new UUID();
    BaseTypes.UUID.apply(this, arguments);
  }
  inherits(UUID, BaseTypes.UUID);

  UUID.prototype.toSql = function toSql() {
    return 'CHAR(36) BINARY';
  };


  const SUPPORTED_GEOMETRY_TYPES = ['POINT', 'LINESTRING', 'POLYGON'];

  function GEOMETRY(type, srid) {
    if (!(this instanceof GEOMETRY)) return new GEOMETRY(type, srid);
    BaseTypes.GEOMETRY.apply(this, arguments);

    if (_.isEmpty(this.type)) {
      this.sqlType = this.key;
    } else if (_.includes(SUPPORTED_GEOMETRY_TYPES, this.type)) {
      this.sqlType = this.type;
    } else {
      throw new Error('Supported geometry types are: ' + SUPPORTED_GEOMETRY_TYPES.join(', '));
    }
  }
  inherits(GEOMETRY, BaseTypes.GEOMETRY);

  GEOMETRY.parse = GEOMETRY.prototype.parse = function parse(value) {
    value = value.buffer();

    // Empty buffer, MySQL doesn't support POINT EMPTY
    // check, https://dev.mysql.com/worklog/task/?id=2381
    if (value.length === 0) {
      return null;
    }

    // For some reason, discard the first 4 bytes
    value = value.slice(4);

    return wkx.Geometry.parse(value).toGeoJSON();
  };

  GEOMETRY.prototype.toSql = function toSql() {
    return this.sqlType;
  };

  function ENUM() {
    if (!(this instanceof ENUM)) {
      const obj = Object.create(ENUM.prototype);
      ENUM.apply(obj, arguments);
      return obj;
    }
    BaseTypes.ENUM.apply(this, arguments);
  }
  inherits(ENUM, BaseTypes.ENUM);

  ENUM.prototype.toSql = function toSql(options) {
    return 'ENUM(' + _.map(this.values, value => options.escape(value)).join(', ') + ')';
  };

  function JSONTYPE() {
    if (!(this instanceof JSONTYPE)) return new JSONTYPE();
    BaseTypes.JSON.apply(this, arguments);
  }
  inherits(JSONTYPE, BaseTypes.JSON);

  JSONTYPE.prototype._stringify = function _stringify(value, options) {
    return options.operation === 'where' && typeof value === 'string' ? value : JSON.stringify(value);
  };

  const exports = {
    ENUM,
    DATE,
    DATEONLY,
    UUID,
    GEOMETRY,
    DECIMAL,
    BLOB,
    JSON: JSONTYPE
  };

  _.forIn(exports, (DataType, key) => {
    if (!DataType.key) DataType.key = key;
    if (!DataType.extend) {
      DataType.extend = function extend(oldType) {
        return new DataType(oldType.options);
      };
    }
  });

  return exports;
};
