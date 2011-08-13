var client = require("mysql").Client.prototype
var Utils = module.exports = {
  _: (function() {
    var _ = require("underscore");
    _.mixin(require('underscore.string'));
    _.mixin({
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
    require("sys").inherits(_class, require('events').EventEmitter)
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
    var DataTypes = require("./data-types")
    
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

    var DataTypes = require("./data-types")
    
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
  simplifyAttributes: function(attributes) {
    var result = {}
    
    Utils._.map(attributes, function(dataType, name) {
      if(Utils.isHash(dataType)) {
        var template     = "<%= type %>"
          , replacements = { type: dataType.type }

        if(dataType.hasOwnProperty('allowNull') && (!dataType.allowNull)) template += " NOT NULL"        
        if(dataType.autoIncrement) template +=" auto_increment"
        if(dataType.defaultValue != undefined) {
          template += " DEFAULT <%= defaultValue %>"
          replacements.defaultValue = Utils.escape(dataType.defaultValue)
        } 
        if(dataType.unique) template += " UNIQUE"
        if(dataType.primaryKey) template += " PRIMARY KEY"
        
        result[name] = Utils._.template(template)(replacements)
      } else {
        result[name] = dataType
      }
    })
    
    return result
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
    var chars1 = Utils._.chars(tableName1.toLowerCase())
      , chars2 = Utils._.chars(tableName2.toLowerCase())
      
    return (chars1[0] < chars2[0]) ? (tableName1 + tableName2) : (tableName2 + tableName1)
  },
  singularize: function(s) {
    return Utils.Lingo.en.isSingular(s) ? s : Utils.Lingo.en.singularize(s)
  },
  pluralize: function(s) {
    return Utils.Lingo.en.isPlural(s) ? s : Utils.Lingo.en.pluralize(s)
  },
  merge: function(a, b, replace){
    for(var key in b) {
      if(a.hasOwnProperty(key) && replace === false) continue;
      a[key] = b[key]
    }
    return a
  }
}

// Some nice class accessors
var CustomEventEmitter = Utils.CustomEventEmitter = function(fct) {
  this.fct = fct
}
Utils.addEventEmitter(CustomEventEmitter)

CustomEventEmitter.prototype.run = function() {
  var self = this
  setTimeout(function(){ self.fct() }, 5) // delay the function call and return the emitter
  return this
}

Utils.QueryChainer = require("./query-chainer")
Utils.Lingo = require("lingo")
