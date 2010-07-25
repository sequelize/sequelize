SequelizeHelper = {
  log: function(obj) {
    var sys = require("sys")
    sys.puts(sys.inspect(obj))
  },
  
  SQL: {
    asTableName: function(name) {
      return name + "s"
    },
    
    valuesForInsertQuery: function(object) {
      var actualValues = object.values,
          result  = []

      SequelizeHelper.Hash.keys(actualValues).forEach(function(key) {
        var value     = actualValues[key],
            dataType  = object.attributes[key]

        result.push(SequelizeHelper.SQL.transformValueByDataType(value, dataType))
      })

      return result
    },

    fieldsForInsertQuery: function(object) {
      return SequelizeHelper.Hash.keys(object.values).join(", ")
    },

    transformValueByDataType: function(value, dataType) {
      var result = null
      switch(dataType) {
        case Sequelize.INTEGER:
          result = value; break;
        default:
          result = "'" + value + "'"; break;
      }
      return result
    },

    valuesForUpdate: function(object, options) {
      var actualValues = object.values,
          result  = []

      options = options || {}

      SequelizeHelper.Hash.keys(actualValues).forEach(function(key) {
        var value     = actualValues[key],
            dataType  = object.attributes[key]

        result.push([key, SequelizeHelper.SQL.transformValueByDataType(value, dataType)].join(" = "))
      })

      return result.join(options.seperator || ", ")
    },
    
    hashToWhereConditions: function(conditions) {
      if(typeof conditions == 'number')
        return ('id = ' + conditions)
      else {
        var result = []
        SequelizeHelper.Hash.forEach(conditions, function(value, key) {
          result.push(key + "=" + SequelizeHelper.SQL.transformValueByDataType(value))
        })
        return result.join(" AND ")
      }
    }
  },
  
  evaluateTemplate: function(template, replacements) {
    var result = template
    SequelizeHelper.Hash.keys(replacements).forEach(function(key) {
      result = result.replace("%{" + key + "}", replacements[key])
    })
    return result
  },
  
  Hash: {
    forEach: function(object, func) {
      SequelizeHelper.Hash.keys(object).forEach(function(key) {
        func(object[key], key, object)
      })
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
    }
  }
}