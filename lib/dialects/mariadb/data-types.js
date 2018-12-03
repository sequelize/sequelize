'use strict';

const _ = require('lodash');
const moment = require('moment-timezone');
const inherits = require('../../utils/inherits');

module.exports = BaseTypes => {
  BaseTypes.ABSTRACT.prototype.dialectTypes = 'https://mariadb.com/kb/en/library/resultset/#field-types';

  /**
   * types: [buffer_type, ...]
   * @see documentation : https://mariadb.com/kb/en/library/resultset/#field-types
   * @see connector implementation : https://github.com/MariaDB/mariadb-connector-nodejs/blob/master/lib/const/field-type.js
   */

  BaseTypes.DATE.types.mariadb = ['DATETIME'];
  BaseTypes.STRING.types.mariadb = ['VAR_STRING'];
  BaseTypes.CHAR.types.mariadb = ['STRING'];
  BaseTypes.TEXT.types.mariadb = ['BLOB'];
  BaseTypes.TINYINT.types.mariadb = ['TINY'];
  BaseTypes.SMALLINT.types.mariadb = ['SHORT'];
  BaseTypes.MEDIUMINT.types.mariadb = ['INT24'];
  BaseTypes.INTEGER.types.mariadb = ['LONG'];
  BaseTypes.BIGINT.types.mariadb = ['LONGLONG'];
  BaseTypes.FLOAT.types.mariadb = ['FLOAT'];
  BaseTypes.TIME.types.mariadb = ['TIME'];
  BaseTypes.DATEONLY.types.mariadb = ['DATE'];
  BaseTypes.BOOLEAN.types.mariadb = ['TINY'];
  BaseTypes.BLOB.types.mariadb = ['TINYBLOB', 'BLOB', 'LONGBLOB'];
  BaseTypes.DECIMAL.types.mariadb = ['NEWDECIMAL'];
  BaseTypes.UUID.types.mariadb = false;
  BaseTypes.ENUM.types.mariadb = false;
  BaseTypes.REAL.types.mariadb = ['DOUBLE'];
  BaseTypes.DOUBLE.types.mariadb = ['DOUBLE'];
  BaseTypes.GEOMETRY.types.mariadb = ['GEOMETRY'];
  BaseTypes.JSON.types.mariadb = ['JSON'];

  function DECIMAL(precision, scale) {
    if (!(this instanceof DECIMAL)) {
      return new DECIMAL(precision, scale);
    }
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
    if (!(this instanceof DATE)) {
      return new DATE(length);
    }
    BaseTypes.DATE.apply(this, arguments);
  }

  inherits(DATE, BaseTypes.DATE);

  DATE.prototype.toSql = function toSql() {
    return `DATETIME${this._length ? `(${this._length})` : ''}`;
  };

  DATE.prototype._stringify = function _stringify(date, options) {
    date = BaseTypes.DATE.prototype._applyTimezone(date, options);
    return date.format('YYYY-MM-DD HH:mm:ss.SSS');
  };

  DATE.parse = function parse(value, options) {
    value = value.string();

    if (value === null) {
      return value;
    }

    if (moment.tz.zone(options.timezone)) {
      value = moment.tz(value, options.timezone).toDate();
    } else {
      value = new Date(`${value} ${options.timezone}`);
    }

    return value;
  };

  function DATEONLY() {
    if (!(this instanceof DATEONLY)) {
      return new DATEONLY();
    }
    BaseTypes.DATEONLY.apply(this, arguments);
  }

  inherits(DATEONLY, BaseTypes.DATEONLY);

  DATEONLY.parse = function parse(value) {
    return value.string();
  };

  function UUID() {
    if (!(this instanceof UUID)) {
      return new UUID();
    }
    BaseTypes.UUID.apply(this, arguments);
  }

  inherits(UUID, BaseTypes.UUID);

  UUID.prototype.toSql = function toSql() {
    return 'CHAR(36) BINARY';
  };

  function GEOMETRY(type, srid) {
    if (!(this instanceof GEOMETRY)) {
      return new GEOMETRY(type, srid);
    }
    BaseTypes.GEOMETRY.apply(this, arguments);

    if (_.isEmpty(this.type)) {
      this.sqlType = this.key;
    } else {
      this.sqlType = this.type;
    }
  }

  inherits(GEOMETRY, BaseTypes.GEOMETRY);

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
    return `ENUM(${this.values.map(value => options.escape(value)).join(', ')})`;
  };

  function JSONTYPE() {
    if (!(this instanceof JSONTYPE)) {
      return new JSONTYPE();
    }
    BaseTypes.JSON.apply(this, arguments);
  }

  inherits(JSONTYPE, BaseTypes.JSON);

  JSONTYPE.prototype._stringify = function _stringify(value, options) {
    return options.operation === 'where' && typeof value === 'string' ? value
      : JSON.stringify(value);
  };

  const exports = {
    ENUM,
    DATE,
    DATEONLY,
    UUID,
    GEOMETRY,
    DECIMAL,
    JSON: JSONTYPE
  };

  _.forIn(exports, (DataType, key) => {
    if (!DataType.key) {
      DataType.key = key;
    }
    if (!DataType.extend) {
      DataType.extend = function extend(oldType) {
        return new DataType(oldType.options);
      };
    }
  });

  return exports;
};
