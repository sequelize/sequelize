'use strict';

const dataTypes = require('./data-types');
const { logger } = require('./utils/logger');

function arrayToList(array, timeZone, dialect, format) {
  return array.reduce((sql, val, i) => {
    if (i !== 0) {
      sql += ', ';
    }

    if (Array.isArray(val)) {
      sql += `(${arrayToList(val, timeZone, dialect, format)})`;
    } else {
      sql += escape(val, timeZone, dialect, format);
    }

    return sql;
  }, '');
}

exports.arrayToList = arrayToList;

function escape(val, timeZone, dialect, format) {
  let prependN = false;
  if (val === undefined || val === null) {
    // There are cases in Db2 for i where 'NULL' isn't accepted, such as
    // comparison with a WHERE() statement. In those cases, we have to cast.
    if (dialect === 'ibmi' && format) {
      return 'cast(NULL as int)';
    }

    return 'NULL';
  }

  switch (typeof val) {
    case 'boolean':
    // SQLite doesn't have true/false support. MySQL aliases true/false to 1/0
    // for us. Postgres actually has a boolean type with true/false literals,
    // but sequelize doesn't use it yet.
      if (['sqlite', 'mssql', 'ibmi'].includes(dialect)) {
        return Number(Boolean(val));
      }

      return (Boolean(val)).toString();
    case 'number':
      return val.toString();
    case 'string':
    // In mssql, prepend N to all quoted vals which are originally a string (for
    // unicode compatibility)
      prependN = dialect === 'mssql';
      break;
  }

  if (val instanceof Date) {
    val = dataTypes[dialect].DATE.prototype.stringify(val, { timezone: timeZone });
  }

  if (Buffer.isBuffer(val)) {
    if (dialect === 'ibmi') {
      return dataTypes[dialect].STRING.prototype.stringify(val);
    }

    if (dataTypes[dialect].BLOB) {
      return dataTypes[dialect].BLOB.prototype.stringify(val);
    }

    return dataTypes.BLOB.prototype.stringify(val);
  }

  if (Array.isArray(val)) {
    const partialEscape = escVal => escape(escVal, timeZone, dialect, format);
    if ((dialect === 'postgres' || dialect === 'yugabyte') && !format) {
      return dataTypes.ARRAY.prototype.stringify(val, { escape: partialEscape });
    }

    return arrayToList(val, timeZone, dialect, format);
  }

  if (!val.replace) {
    throw new Error(`Invalid value ${logger.inspect(val)}`);
  }

  if (['postgres', 'sqlite', 'mssql', 'snowflake', 'db2', 'ibmi', 'yugabyte'].includes(dialect)) {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    val = val.replace(/'/g, '\'\'');

    if (dialect === 'postgres' || dialect === 'yugabyte') {
      // null character is not allowed in Postgres
      val = val.replace(/\0/g, '\\0');
    }
  } else {

    // eslint-disable-next-line no-control-regex -- \u001A is intended to be in this regex
    val = val.replace(/[\b\0\t\n\r\u001A"'\\]/g, s => {
      switch (s) {
        case '\0': return '\\0';
        case '\n': return '\\n';
        case '\r': return '\\r';
        case '\b': return '\\b';
        case '\t': return '\\t';
        case '\u001A': return '\\Z';
        default: return `\\${s}`;
      }
    });
  }

  return `${(prependN ? 'N\'' : '\'') + val}'`;
}

exports.escape = escape;

function format(sql, values, timeZone, dialect) {
  values = [values].flat();

  if (typeof sql !== 'string') {
    throw new TypeError(`Invalid SQL string provided: ${sql}`);
  }

  return sql.replace(/\?/g, match => {
    if (values.length === 0) {
      return match;
    }

    return escape(values.shift(), timeZone, dialect, true);
  });
}

exports.format = format;

function formatNamedParameters(sql, values, timeZone, dialect) {
  return sql.replace(/:+(?!\d)(\w+)/g, (value, key) => {
    if ((dialect === 'postgres' || dialect === 'yugabyte') && value.slice(0, 2) === '::') {
      return value;
    }

    if (values[key] !== undefined) {
      return escape(values[key], timeZone, dialect, true);
    }

    throw new Error(`Named parameter "${value}" has no value in the given object.`);
  });
}

exports.formatNamedParameters = formatNamedParameters;
