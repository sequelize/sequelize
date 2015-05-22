'use strict';

/* jshint -W110 */
var moment = require('moment-timezone')
  , Utils = require('../../utils')
  , isArrayBufferView
  , SqlString = {};

if (typeof ArrayBufferView === 'function') {
  isArrayBufferView = function(object) { return object && (object instanceof ArrayBufferView); };
} else {
  var arrayBufferViews = [
    Int8Array, Uint8Array, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array
  ];
  isArrayBufferView = function(object) {
    for (var i = 0; i < 8; i++) {
      if (object instanceof arrayBufferViews[i]) {
        return true;
      }
    }
    return false;
  };
}

SqlString.escape = function(val, stringifyObjects, timeZone, dialect, field) {
  if (arguments.length === 1 && typeof val === 'object' && val !== null) {
    val = val.val || val.value || null;
    stringifyObjects = val.stringifyObjects || val.objects || undefined;
    timeZone = val.timeZone || val.zone || null;
    dialect = val.dialect || null;
    field = val.field || null;
  }
  else if (arguments.length === 2 && typeof stringifyObjects === 'object' && stringifyObjects !== null) {
    timeZone = stringifyObjects.timeZone || stringifyObjects.zone || null;
    dialect = stringifyObjects.dialect || null;
    field = stringifyObjects.field || null;
  }
  if (val === undefined || val === null) {
    return 'NULL';
  }
  switch (typeof val) {
  case 'boolean':
    // SQLite doesn't have true/false support. MySQL aliases true/false to 1/0
    // for us. Postgres actually has a boolean type with true/false literals,
    // but sequelize doesn't use it yet.
    if (dialect === 'mssql') {
      return "'" + val + "'";
    }
    if (dialect === 'sqlite' || dialect === 'oracle') {
      return +!!val;
    }
    return '' + !!val;
  case 'number':
    return val + '';
  }

  if (val instanceof Date && dialect==='oracle') {
    return SqlString.dateToString(val, timeZone || 'Z', dialect);
  }

  if (val instanceof Date) {
    val = SqlString.dateToString(val, timeZone || 'Z', dialect);
  }

  if (Buffer.isBuffer(val)) {
    return SqlString.bufferToString(val, dialect);
  }
  if (Array.isArray(val) || isArrayBufferView(val)) {
    return SqlString.arrayToList(val, timeZone, dialect, field);
  }

  if (typeof val === 'object' && val !== null) {
    if (stringifyObjects) {
      val = val.toString();
    } else {
      return SqlString.objectToValues(val, timeZone);
    }
  }

  if (dialect === 'postgres' || dialect === 'sqlite' || dialect === 'mssql' || dialect === 'oracle') {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    val = val.replace(/'/g, "''");
  } else {
    val = val.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function(s) {
      switch (s) {
        case '\0': return '\\0';
        case '\n': return '\\n';
        case '\r': return '\\r';
        case '\b': return '\\b';
        case '\t': return '\\t';
        case '\x1a': return '\\Z';
        default: return '\\' + s;
      }
    });
  }
  return "'" + val + "'";
};

SqlString.dateToString = function(date, timeZone, dialect) {
  if (moment.tz.zone(timeZone)) {
    date = moment(date).tz(timeZone);
  } else {
    date = moment(date).utcOffset(timeZone);
  }

  if (dialect === 'mysql' || dialect === 'mariadb') {
    return date.format('YYYY-MM-DD HH:mm:ss');
  } else if (dialect === 'oracle') {
    return 'TO_TIMESTAMP_TZ(\''+date.format('YYYY-MM-DD HH:mm:ss.SSS Z')+'\',\'YYYY-MM-DD HH24:MI:SS.FF3 TZH:TZM\')';
  } else {
    // ZZ here means current timezone, _not_ UTC
    return date.format('YYYY-MM-DD HH:mm:ss.SSS Z');
  }
};

module.exports = (function() {

  return Utils._.extend(Utils._.clone(require('../../sql-string')),SqlString);
})();