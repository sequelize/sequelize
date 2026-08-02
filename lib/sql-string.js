import dataTypes from './data-types.js';
import util from 'node:util';
import _ from 'lodash';

export function arrayToList(array, timeZone, dialect, formatAsList) {
  return array.reduce((sql, val, i) => {
    if (i !== 0) {
      sql += ', ';
    }
    if (Array.isArray(val)) {
      sql += `(${arrayToList(val, timeZone, dialect, formatAsList)})`;
    } else {
      sql += escape(val, timeZone, dialect, formatAsList);
    }
    return sql;
  }, '');
}

export function escape(val, timeZone, dialect, formatAsList) {
  if (val === undefined || val === null) {
    return 'NULL';
  }
  switch (typeof val) {
    case 'boolean':
      return String(!!val);
    case 'number':
      return String(val);
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
    const partialEscape = _.partial(escape, _, timeZone, dialect, formatAsList);
    if (!formatAsList) {
      return dataTypes.ARRAY.prototype.stringify(val, { escape: partialEscape });
    }
    return arrayToList(val, timeZone, dialect, formatAsList);
  }

  if (!val.replace) {
    throw new Error('Invalid value ' + util.inspect(val));
  }

  // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
  // http://stackoverflow.com/q/603572/130598
  val = val.replace(/'/g, "''");

  // NUL bytes are deliberately left alone. Postgres rejects them outright
  // (ERROR: null character not permitted), which is the correct outcome -- a
  // value that cannot be represented should fail loudly rather than be silently
  // substituted. Callers that want to tolerate NULs must strip them themselves.

  return "'" + val + "'";
}

export function format(sql, values, timeZone, dialect) {
  values = [].concat(values);

  if (typeof sql !== 'string') {
    throw new Error('Invalid SQL string provided: ' + sql);
  }
  return sql.replace(/\?/g, (match) => {
    if (!values.length) {
      return match;
    }

    return escape(values.shift(), timeZone, dialect, true);
  });
}

export function formatNamedParameters(sql, values, timeZone, dialect) {
  return sql.replace(/:+(?!\d)(\w+)/g, (value, key) => {
    if ('postgres' === dialect && '::' === value.slice(0, 2)) {
      return value;
    }

    if (values[key] !== undefined) {
      return escape(values[key], timeZone, dialect, true);
    } else {
      throw new Error('Named parameter "' + value + '" has no value in the given object.');
    }
  });
}
