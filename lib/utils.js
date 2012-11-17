var mysql      = require("mysql")
  , connection = mysql.createConnection({})
  , util       = require("util")
  , DataTypes  = require("./data-types")

var Utils = module.exports = {
  _: (function() {
    var _  = require("underscore")
      , _s = require('underscore.string')

    _.mixin(_s.exports())
    _.mixin({
      includes: _s.include,
      camelizeIf: function(string, condition) {
        var result = string

        if(condition) {
          result = _.camelize(string)
        }

        return result
      },
      underscoredIf: function(string, condition) {
        var result = string

        if(condition) {
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
  TICK_CHAR: '`',
  addTicks: function(s) {
    return Utils.TICK_CHAR + Utils.removeTicks(s) + Utils.TICK_CHAR
  },
  removeTicks: function(s) {
    return s.replace(new RegExp(Utils.TICK_CHAR, 'g'), "")
  },
  escape: function(s) {
    return connection.escape(s).replace(/\\"/g, '"')
  },
  format: function(arr) {
    var query        = arr[0]
      , replacements = Utils._.compact(arr.map(function(obj) { return obj != query ? obj : null}))

    return connection.format.apply(connection, [query, replacements])
  },
  isHash: function(obj) {
    return Utils._.isObject(obj) && !Utils._.isArray(obj);
  },
  toSqlDate: function(date) {
    return [
      [
        date.getFullYear(),
        ((date.getMonth() < 9 ? '0' : '') + (date.getMonth()+1)),
        ((date.getDate() < 10 ? '0' : '') + date.getDate())
      ].join("-"),
      date.toLocaleTimeString()
    ].join(" ")
  },
  argsArePrimaryKeys: function(args, primaryKeys) {
    var result = (args.length == Utils._.keys(primaryKeys).length)
    if (result) {
      Utils._.each(args, function(arg) {
        if(result) {
          if(['number', 'string'].indexOf(typeof arg) !== -1)
            result = true
          else
            result = (arg instanceof Date)

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
    return (value == DataTypes.NOW) ? new Date() : value
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

    if(omitNull) {
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
  }
}

Utils.CustomEventEmitter = require("./emitters/custom-event-emitter")
Utils.QueryChainer = require("./query-chainer")
Utils.Lingo = require("lingo")
