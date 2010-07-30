SequelizeHelper = {
  log: function(obj) {
    var sys = require("sys")
    sys.puts(sys.inspect(obj))
  },
  
  evaluateTemplate: function(template, replacements) {
    var result = template
    SequelizeHelper.Hash.keys(replacements).forEach(function(key) {
      result = result.replace("%{" + key + "}", replacements[key])
    })
    return result
  },
  
  SQL: {
    manyToManyTableName: function(t1, t2) {
      return [t1.tableName, t2.tableName].sort().join("")
    },
    
    asTableIdentifier: function(name) {
      return name.toLowerCase().replace(/s$/, "") + "Id"
    },
    
    asTableName: function(name) {
      return name + "s"
    },
    
    asSqlDate: function(date) {
      return [
        [
          date.getFullYear(),
          ((date.getMonth() < 9 ? '0' : '') + (date.getMonth()+1)),
          ((date.getDate() < 10 ? '0' : '') + date.getDate())
        ].join("-"),
        date.toLocaleTimeString()
      ].join(" ")
    },
    
    valuesForInsertQuery: function(object) {
      var actualValues = object.values,
          result  = []

      SequelizeHelper.Hash.forEach(actualValues, function(value, key) {
        var dataType  = object.table.attributes[key]
        result.push(SequelizeHelper.SQL.transformValueByDataType(value, dataType))
      })

      return result
    },

    fieldsForInsertQuery: function(object) {
      return SequelizeHelper.Hash.keys(object.values).join(", ")
    },

    transformValueByDataType: function(value, dataType) {
      if((value == null)||(typeof value == 'undefined'))
        return "NULL"
      
      if(dataType.indexOf(Sequelize.INTEGER) > -1)
        return value
      
      if(dataType.indexOf(Sequelize.DATE) > -1)
        return ("'" + SequelizeHelper.SQL.asSqlDate(value) + "'")
      
      return ("'" + value + "'")
    },

    valuesForUpdate: function(object, options) {
      var actualValues = object.values,
          result  = []

      options = options || {}

      SequelizeHelper.Hash.forEach(actualValues, function(value, key) {
        var dataType  = object.table.attributes[key]
        result.push([key, SequelizeHelper.SQL.transformValueByDataType(value, dataType)].join(" = "))
      })

      return result.join(options.seperator || ", ")
    },
    
    hashToWhereConditions: function(conditions, attributes) {
      if(typeof conditions == 'number')
        return ('id = ' + conditions)
      else {
        var result = []
        SequelizeHelper.Hash.forEach(conditions, function(value, key) {
          result.push(key + "=" + SequelizeHelper.SQL.transformValueByDataType(value, attributes[key]))
        })
        return result.join(" AND ")
      }
    }
  },
  
  Hash: {
    forEach: function(object, func) {
      SequelizeHelper.Hash.keys(object).forEach(function(key) {
        func(object[key], key, object)
      })
    },
    
    map: function(object, func) {
      var result = []
      SequelizeHelper.Hash.forEach(object, function(value, key, object) {
        result.push(func(value, key, object))
      })
      return result
    },
    
    keys: function(object) {
      var results = []
      for (var property in object)
        results.push(property)
      return results
    },

    values: function(object) {
      var result = []
      SequelizeHelper.Hash.keys(object).forEach(function(key) {
        result.push(object[key])
      })
      return result
    },
    
    merge: function(source, target, force) {
      SequelizeHelper.Hash.forEach(source, function(value, key) {
        if(!target[key] || force)
          target[key] = value
      })
      return target
    }
  }
}