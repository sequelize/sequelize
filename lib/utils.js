var client    = new (require("mysql").Client)()
  , util      = require("util")
  , DataTypes = require("./data-types")

var Utils = module.exports = {
  _: (function() {
    var _  = require("underscore")
      , _s = require('underscore.string')

    _.mixin(_s.exports())
    _.mixin({
      includes: _s.include,
      camelizeIf: function(string, condition) {
        var result = string
        if(condition) result = _.camelize(string)
        return result
      },
      underscoredIf: function(string, condition) {
        var result = string
        if(condition) result = _.underscored(string)
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
    return s.replace("`", "")
  },
  escape: function(s) {
    return client.escape(s)
  },
  format: function(arr) {
    var query        = arr[0]
      , replacements = Utils._.compact(arr.map(function(obj) { return obj != query ? obj : null}))

    return client.format.apply(client, [query, replacements])
  },
  isHash: function(obj) {
    return (typeof obj == 'object') && !obj.hasOwnProperty('length')
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
    Utils._.each(args, function(arg) {
      if(result) {
        if(['number', 'string'].indexOf(typeof arg) > -1)
          result = true
        else
          result = (arg instanceof Date)

      }
    })
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

  merge: function(a, b){
    for(var key in b) {
      a[key] = b[key]
    }
    return a
  },

  removeCommentsFromFunctionString: function(s) {
    s = s.replace(/\s*(\/\/.*)/g, '')
    s = s.replace(/(\/\*[\n\r\s\S]*?\*\/)/mg, '')

    return s
  },

  toDefaultValue: function(value) {
    return (value == DataTypes.NOW) ? new Date() : value
  }
}

Utils.CustomEventEmitter = require("./emitters/custom-event-emitter")
Utils.QueryChainer = require("./query-chainer")
Utils.Lingo = require("lingo")
