var util       = require("util")
  , DataTypes  = require("./data-types")
  , SqlString  = require("./sql-string")

var Utils = module.exports = {
  _: (function() {
    var _  = require("lodash")
      , _s = require('underscore.string')

    _.mixin(_s.exports())
    _.mixin({
      includes: _s.include,
      camelizeIf: function(string, condition) {
        var result = string

        if (condition) {
          result = _.camelize(string)
        }

        return result
      },
      underscoredIf: function(string, condition) {
        var result = string

        if (condition) {
          result = _.underscored(string)
        }

        return result
      }
    })

    return _
  })(),
  addEventEmitter: function(_class) {
    util.inherits(_class, require('events').EventEmitter)
  },
  format: function(arr, dialect) {
    var timeZone = null;
    return SqlString.format(arr.shift(), arr, timeZone, dialect)
  },
  isHash: function(obj) {
    return Utils._.isObject(obj) && !Array.isArray(obj);
  },
  pad: function (s) {
    return s < 10 ? '0' + s : s
  },
  toSqlDate: function(date) {
    return date.getUTCFullYear() + '-' +
      this.pad(date.getUTCMonth()+1) + '-' +
      this.pad(date.getUTCDate()) + ' ' +
      this.pad(date.getUTCHours()) + ':' +
      this.pad(date.getUTCMinutes()) + ':' +
      this.pad(date.getUTCSeconds())
  },
  argsArePrimaryKeys: function(args, primaryKeys) {
    var result = (args.length == Object.keys(primaryKeys).length)
    if (result) {
      Utils._.each(args, function(arg) {
        if (result) {
          if (['number', 'string'].indexOf(typeof arg) !== -1) {
            result = true
          } else {
            result = (arg instanceof Date)
          }
        }
      })
    }
    return result
  },
  combineTableNames: function(tableName1, tableName2) {
    return (tableName1.toLowerCase() < tableName2.toLowerCase()) ? (tableName1 + tableName2) : (tableName2 + tableName1)
  },

  singularize: function(s) {
    return Utils.Lingo.en.isSingular(s) ? s : Utils.Lingo.en.singularize(s)
  },

  pluralize: function(s) {
    return Utils.Lingo.en.isPlural(s) ? s : Utils.Lingo.en.pluralize(s)
  },

  removeCommentsFromFunctionString: function(s) {
    s = s.replace(/\s*(\/\/.*)/g, '')
    s = s.replace(/(\/\*[\n\r\s\S]*?\*\/)/mg, '')

    return s
  },

  toDefaultValue: function(value) {
    return (value === DataTypes.NOW) ? Utils.now() : value
  },

  setAttributes: function(hash, identifier, instance, prefix) {
    prefix = prefix || ''
    if (this.isHash(identifier)) {
      this._.each(identifier, function(elem, key) {
        hash[prefix + key] = Utils._.isString(instance) ? instance : Utils._.isObject(instance) ? instance[elem.key || elem] : null
      })
    } else {
      hash[prefix + identifier] = Utils._.isString(instance) ? instance : Utils._.isObject(instance) ? instance.id : null
    }

    return hash
  },

  removeNullValuesFromHash: function(hash, omitNull) {
    var result = hash

    if (omitNull) {
      var _hash = {}

      Utils._.each(hash, function(val, key) {
        if (key.match(/Id$/) || ((val !== null) && (val !== undefined))) {
          _hash[key] = val;
        }
      })

      result = _hash
    }

    return result
  },

  prependTableNameToHash: function(tableName, hash) {
    if (tableName) {
      var _hash = {}

      for (var key in hash) {
        if (key.indexOf('.') === -1) {
          _hash[tableName + '.' + key] = hash[key]
        } else {
          _hash[key] = hash[key]
        }
      }

      return _hash
    } else {
      return hash
    }
  },

  firstValueOfHash: function(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key))
        return obj[key]
    }
    return null
  },

  inherit: function(subClass, superClass) {
    if (superClass.constructor == Function) {
      // Normal Inheritance
      subClass.prototype = new superClass();
      subClass.prototype.constructor = subClass;
      subClass.prototype.parent = superClass.prototype;
    } else {
      // Pure Virtual Inheritance
      subClass.prototype = superClass;
      subClass.prototype.constructor = subClass;
      subClass.prototype.parent = superClass;
    }

    return subClass;
  },

  now: function() {
    var now = new Date()
    now.setMilliseconds(0)
    return now
  },

  // Note: Use the `quoteIdentifier()` and `escape()` methods on the
  // `QueryInterface` instead for more portable code.

  TICK_CHAR: '`',
  addTicks: function(s, tickChar) {
    tickChar = tickChar || Utils.TICK_CHAR
    return tickChar + Utils.removeTicks(s, tickChar) + tickChar
  },
  removeTicks: function(s, tickChar) {
    tickChar = tickChar || Utils.TICK_CHAR
    return s.replace(new RegExp(tickChar, 'g'), "")
  },
  escape: function(s) {
    return SqlString.escape(s, true, "local").replace(/\\"/g, '"')
  }
}

Utils.CustomEventEmitter = require("./emitters/custom-event-emitter")
Utils.QueryChainer = require("./query-chainer")
Utils.Lingo = require("lingo")