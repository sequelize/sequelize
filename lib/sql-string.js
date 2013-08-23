var moment = require("moment")
  , SqlString = exports;

SqlString.escapeId = function (val, forbidQualified) {
  if (forbidQualified) {
    return '`' + val.replace(/`/g, '``') + '`';
  }
  return '`' + val.replace(/`/g, '``').replace(/\./g, '`.`') + '`';
};

SqlString.escape = function(val, stringifyObjects, timeZone, dialect, field) {
  if (arguments.length === 1 && typeof arguments[0] === "object") {
    val = val.val || val.value || null
    stringifyObjects = val.stringifyObjects || val.objects || undefined
    timeZone = val.timeZone || val.zone || null
    dialect = val.dialect || null
    field = val.field || null
  }
  else if (arguments.length < 3 && typeof arguments[1] === "object") {
    timeZone = stringifyObjects.timeZone || stringifyObjects.zone || null
    dialect = stringifyObjects.dialect || null
    field = stringifyObjects.field || null
  }

  if (val === undefined || val === null) {
    return 'NULL';
  }

  switch (typeof val) {
  case 'boolean':
    // SQLite doesn't have true/false support. MySQL aliases true/false to 1/0
    // for us. Postgres actually has a boolean type with true/false literals,
    // but sequelize doesn't use it yet.
    return dialect === 'sqlite' ? +!!val : ('' + !!val);
  case 'number':
    return val+'';
  }

  if (val instanceof Date) {
    val = SqlString.dateToString(val, timeZone || "Z", dialect);
  }

  if (Buffer.isBuffer(val)) {
    return SqlString.bufferToString(val, dialect);
  }

  if (Array.isArray(val)) {
    return SqlString.arrayToList(val, timeZone, dialect, field);
  }

  if (typeof val === 'object') {
    if (stringifyObjects) {
      val = val.toString();
    } else {
      return SqlString.objectToValues(val, timeZone);
    }
  }

  if (dialect === 'postgres' || dialect === 'sqlite') {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    val = val.replace(/'/g, "''");
  } else {
    val = val.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function(s) {
      switch(s) {
        case "\0": return "\\0";
        case "\n": return "\\n";
        case "\r": return "\\r";
        case "\b": return "\\b";
        case "\t": return "\\t";
        case "\x1a": return "\\Z";
        default: return "\\"+s;
      }
    });
  }
  return "'"+val+"'";
};

SqlString.arrayToList = function(array, timeZone, dialect, field) {
  if (dialect === 'postgres') {
    var ret = 'ARRAY[' + array.map(function(v) {
      return SqlString.escape(v, true, timeZone, dialect, field);
    }).join(',') + ']';
    if (!!field && !!field.type) {
      ret += '::' + field.type.replace(/\(\d+\)/g, '');
    }
    return ret;
  } else {
    return array.map(function(v) {
      if (Array.isArray(v))
        return '(' + SqlString.arrayToList(v, timeZone, dialect) + ')';
      return SqlString.escape(v, true, timeZone, dialect);
    }).join(', ');
  }
};

SqlString.format = function(sql, values, timeZone, dialect) {
  values = [].concat(values);

  return sql.replace(/\?/g, function(match) {
    if (!values.length) {
      return match;
    }

    return SqlString.escape(values.shift(), false, timeZone, dialect);
  });
};

SqlString.formatNamedParameters = function(sql, values, timeZone, dialect) {
  return sql.replace(/\:(\w+)/g, function (value, key) {
    if (values.hasOwnProperty(key)) {
      return SqlString.escape(values[key], false, timeZone, dialect);
    }
    else {
      throw new Error('Named parameter "' + value + '" has no value in the given object.');
    }
  });
};

SqlString.dateToString = function(date, timeZone, dialect) {
  var dt = new Date(date);

  // TODO: Ideally all dialects would work a bit more like this
  if (dialect === "postgres") {
    return moment(dt).zone('+00:00').format("YYYY-MM-DD HH:mm:ss.SSS Z");
  }

  if (timeZone !== 'local') {
    var tz = convertTimezone(timeZone);

    dt.setTime(dt.getTime() + (dt.getTimezoneOffset() * 60000));
    if (tz !== false) {
      dt.setTime(dt.getTime() + (tz * 60000));
    }
  }

  return moment(dt).format("YYYY-MM-DD HH:mm:ss");
};

SqlString.bufferToString = function(buffer, dialect) {
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

  if (dialect === 'postgres') {
    // bytea hex format http://www.postgresql.org/docs/current/static/datatype-binary.html
    return "E'\\\\x" + hex+ "'";
  }
  return "X'" + hex+ "'";
};

SqlString.objectToValues = function(object, timeZone) {
  var values = [];
  for (var key in object) {
    var value = object[key];
    if(typeof value === 'function') {
      continue;
    }

    values.push(this.escapeId(key) + ' = ' + SqlString.escape(value, true, timeZone));
  }

  return values.join(', ');
};

function zeroPad(number) {
  return (number < 10) ? '0' + number : number;
}

function convertTimezone(tz) {
  if (tz == "Z") return 0;

  var m = tz.match(/([\+\-\s])(\d\d):?(\d\d)?/);
  if (m) {
    return (m[1] == '-' ? -1 : 1) * (parseInt(m[2], 10) + ((m[3] ? parseInt(m[3], 10) : 0) / 60)) * 60;
  }
  return false;
}
