var moment = require('moment')
  , _ = require('lodash')
  , SqlString = exports;

SqlString.escapeId = function (val, forbidQualified) {
  if (forbidQualified) {
    return '`' + val.replace(/`/g, '``') + '`';
  }
  return '`' + val.replace(/`/g, '``').replace(/\./g, '`.`') + '`';
};

// Escape a SQL query given some basic options:
// - stringifyObjects: If true, call toString on any objects. If false, try to
//   pull out key-value pairs.
// - timeZone: Timezone to convert dates to in ISO 8601 format (defaults to UTC)
// - dialect: One of the following: "mysql" (default), "postgres", or "sqlite"
// - field: A marker representing the postgres datatype for any supplied arrays.
//   If our value is an empty array, we'll expliclity mark a type using this.
SqlString.escape = function(val, options) {
  // Set default options
  options = _.defaults({}, options || {}, {
    stringifyObjects: false,
    timeZone: 'Z',
    dialect: 'mysql',
    field: null // only needed by postgres for arrays
  });

  if (val === undefined || val === null) {
    return 'NULL';
  }

  switch (typeof val) {
    case 'boolean':
      switch (options.dialect) {
        case 'mysql': // MySQL aliases true/false to 1/0 for us.
        case 'postgres': // Postgres actually has boolean support
          return ('' + !!val);
        case 'sqlite': // SQLite doesn't have any true/false support
          return +!!val
      }
    case 'number': return '' + val;
  }

  if (val instanceof Date) {
    val = SqlString.dateToString(val, options);
  }

  if (Buffer.isBuffer(val)) {
    return SqlString.bufferToString(val);
  }

  if (Array.isArray(val)) {
    return SqlString.arrayToList(val, options);
  }

  if (typeof val === 'object') {
    if (options.stringifyObjects) {
      val = val.toString();
    } else {
      return SqlString.objectToValues(val, options);
    }
  }

  switch(options.dialect) {
    case 'postgres': // http://postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    case 'sqlite': // http://stackoverflow.com/q/603572/130598
      val = val.replace(/'/g, "''");
      break;
    case 'mysql':
      val = val.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function(s) {
        switch(s) {
          case '\0': return '\\0';
          case '\n': return '\\n';
          case '\r': return '\\r';
          case '\b': return '\\b';
          case '\t': return '\\t';
          case '\x1a': return '\\Z';
          default: return '\\' + s;
        }
      });
      break;
  }
  return "'" + val + "'";
};

SqlString.arrayToList = function(array, options) {
  options = _.extend({}, options || {}, {stringifyObjects: true});
  _.defaults(options, {dialect: 'mysql', field: null});

  switch(options.dialect) {
    case 'postgres':
      var ret = 'ARRAY[' + array.map(function(v) {
        return SqlString.escape(v, options);
      }).join(',') + ']';
      if (!!options.field && !!options.field.type) {
        ret += '::' + options.field.type.replace(/\(\d+\)/g, '');
      }
      return ret;
    case 'mysql':
    case 'sqlite':
      return array.map(function(v) {
        if (Array.isArray(v))
          return '(' + SqlString.arrayToList(v, options) + ')';
        return SqlString.escape(v, options);
      }).join(', ');
  }
};

SqlString.format = function(sql, values, options) {
  values = [].concat(values);

  return sql.replace(/\?/g, function(match) {
    if (!values.length) {
      return match;
    }

    return SqlString.escape(values.shift(), options);
  });
};

SqlString.dateToString = function(date, options) {
  options = _.defaults({}, options || {}, {
    timeZone: 'Z',
    dialect: 'mysql'
  });

  var dt = new Date(date);
 
  switch(options.dialect) {
    case 'postgres': // TODO: Ideally all dialects would work a bit more like this
      return moment(dt).format('YYYY-MM-DD HH:mm:ss.SSS Z');
    case 'mysql':
    case 'sqlite':
      if (options.timeZone !== 'local') {
        var tz = convertTimezone(options.timeZone);

        dt.setTime(dt.getTime() + (dt.getTimezoneOffset() * 60000));
        if (tz !== false) {
          dt.setTime(dt.getTime() + (tz * 60000));
        }
      }
      return moment(dt).format('YYYY-MM-DD HH:mm:ss');
  }
};

SqlString.bufferToString = function(buffer) {
  var hex = '';
  try {
    hex = buffer.toString('hex');
  } catch (err) {
    // node v0.4.x does not support hex / throws unknown encoding error
    for (var i = 0; i < buffer.length; i++) {
      var byte = buffer[i];
      hex += zeroPad(byte.toString(16));
    }
  }

  return "X'" + hex+ "'";
};

SqlString.objectToValues = function(object, options) {
  options = _.extend({}, options, {stringifyObjects: true});
  var values = [];
  for (var key in object) {
    var value = object[key];
    if(typeof value === 'function') {
      continue;
    }

    values.push(this.escapeId(key) + ' = ' + SqlString.escape(value, options));
  }

  return values.join(', ');
};

function zeroPad(number) {
  return (number < 10) ? '0' + number : number;
}

function convertTimezone(tz) {
  if (tz === 'Z') return 0;

  var m = tz.match(/([\+\-\s])(\d\d):?(\d\d)?/);
  if (m) {
    return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) + ((m[3] ? parseInt(m[3], 10) : 0) / 60)) * 60;
  }
  return false;
}
