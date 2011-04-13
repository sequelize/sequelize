var client = new (require("mysql").Client)()
var Utils = module.exports = {
  _: require("underscore"),
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
        if(dataType.defaultValue) {
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
  }
}