var client = new (require("mysql").Client)()
  , util    = require("util")
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
  inherit: function(klass, _super) {
    util.inherits(klass, _super)
  },
  addEventEmitter: function(_class) {
    Utils.inherit(_class, require('events').EventEmitter)
  },
  addTicks: function(s) {
    return '`' + Utils.removeTicks(s) + '`'
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
  getDataTypeForValue: function(value) {
    switch(typeof value) {
      case 'number':
        return (value.toString().indexOf('.') > -1) ? DataTypes.FLOAT : DataTypes.INTEGER
        break
      case 'boolean':
        return DataTypes.BOOLEAN
        break
      case 'object':
        return (value.getMilliseconds) ? DataTypes.DATE : "WTF!"
        break
      default:
        return DataTypes.TEXT
        break
    }
  },
  transformValueByDataType: function(value, dataType) {
    dataType = dataType || Utils.getDataTypeForValue(value)

    if((value == null)||(typeof value == 'undefined')||((dataType.indexOf(DataTypes.INTEGER) > -1) && isNaN(value)))
      return "NULL"

    if(dataType.indexOf(DataTypes.FLOAT) > -1)
      return (typeof value == 'number') ? value : parseFloat(value.replace(",", "."))

    if(dataType.indexOf(DataTypes.BOOLEAN) > -1)
      return (value === true ? 1 : 0)

    if(dataType.indexOf(DataTypes.INTEGER) > -1)
      return value

    if(dataType.indexOf(DataTypes.DATE) > -1)
      return ("'" + Utils.asSqlDate(value) + "'")

    return ("'" + value + "'")
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
  addForeignKeyField: function(targetModel, foreignKeyFieldName){
    // if foreign key field is already defined in target table then don't override it's attributes settings, but do check its type
    if (targetModel.rawAttributes.hasOwnProperty(foreignKeyFieldName)) {
        if (DataTypes.INTEGER !== targetModel.rawAttributes[foreignKeyFieldName].type)
            throw new Error("Field " + foreignKeyFieldName + " of " + targetModel.name + " must be of type INTEGER in order for it to be usable as a foreign key")
    } else {
        var newAttributes = {}
        newAttributes[foreignKeyFieldName] = { type: DataTypes.INTEGER }
        Utils._.extend(targetModel.rawAttributes, newAttributes)
    }
  },
  removeCommentsFromFunctionString: function(s) {
    s = s.replace(/\s*(\/\/.*)/g, '')
    s = s.replace(/(\/\*[\n\r\s\S]*?\*\/)/mg, '')

    return s
  }
}

Utils.CustomEventEmitter = require("./emitters/custom-event-emitter")
Utils.QueryChainer = require("./query-chainer")
Utils.Lingo = require("lingo")
