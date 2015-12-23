'use strict';

/* jshint -W110 */
var dataTypes = require('./data-types')
  , _ = require('lodash')
  , SqlString = exports;

SqlString.escapeId = function(val, forbidQualified) {
  if (forbidQualified) {
    return '`' + val.replace(/`/g, '``') + '`';
  }
  return '`' + val.replace(/`/g, '``').replace(/\./g, '`.`') + '`';
};

SqlString.escape = function(val, timeZone, dialect) {
  if (val === undefined || val === null) {
    return 'NULL';
  }
  switch (typeof val) {
  case 'boolean':
    // SQLite doesn't have true/false support. MySQL aliases true/false to 1/0
    // for us. Postgres actually has a boolean type with true/false literals,
    // but sequelize doesn't use it yet.
    if (dialect === 'sqlite' || dialect === 'mssql') {
      return +!!val;
    }
    return '' + !!val;
  case 'number':
    return val + '';
  }

  if (val instanceof Date) {
    val = dataTypes[dialect].DATE.prototype.stringify(val, { timezone: timeZone });
  }

  if (Buffer.isBuffer(val)) {
    if (dataTypes[dialect].BLOB) {
      return dataTypes[dialect].BLOB.prototype.stringify(val);
    }

    return dataTypes.BLOB.prototype.stringify(val);
  }

  if (Array.isArray(val)) {
    var escape = _.partialRight(SqlString.escape, timeZone, dialect);
    if (dialect === 'postgres') {
      return dataTypes.ARRAY.prototype.stringify(val, {escape: escape});
    } else {
      return '[' + val.map(escape) + ']';
    }
  }

  if (dialect === 'postgres' || dialect === 'sqlite' || dialect === 'mssql') {
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

SqlString.format = function(sql, values, timeZone, dialect) {
  values = [].concat(values);

  return sql.replace(/\?/g, function(match) {
    if (!values.length) {
      return match;
    }

    return SqlString.escape(values.shift(), timeZone, dialect);
  });
};

/**
 * Formats name replacements passed to a raw query
 * @param  {String} sql                   The sql query with named replacement tags
 * @param  {Object} values                (replacementName: value) The values to replace the tags with
 * @param  {Object} options               Contains other optional values to pass in
 * @param  {String} options.dialect       The SQL dialct to use (postgres, mysql, etc...)
 * @param  {Bool}   options.escapeValues  Auto escape values before inserting into sql
 * @param  {String} [options.timeZone]    Optional timezone to pass in
 * @return {String} Updated sql query with replaced tags
 */
SqlString.formatNamedParameters = function(sql, values, options) {
  return sql.replace(/\:+(?!\d)(\w+)/g, function(value, key) {
    if ('postgres' === options.dialect && '::' === value.slice(0, 2)) {
      return value;
    }

    if (values[key] !== undefined && options.escapeValues) {
      return SqlString.escape(values[key], options.timeZone, options.dialect);
    } else if (values[key] !== undefined) {
      return values[key];
    } else {
      throw new Error('Named parameter "' + value + '" has no value in the given object.');
    }
  });
};
