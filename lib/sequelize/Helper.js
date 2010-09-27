exports.Helper = function(Sequelize) {
  var Helper = {
    log: function(obj) {
      var sys = require("sys")
      sys.log(sys.inspect(obj))
    },

    evaluateTemplate: function(template, replacements) {
      var result = template
      Helper.Hash.keys(replacements).forEach(function(key) {
        result = result.replace("%{" + key + "}", replacements[key])
      })
      return result
    },

    SQL: {
      isManyToManyAssociation: function(association) {
        return (['hasMany', 'hasAndBelongsToMany'].indexOf(association.type) > -1)
      },

      manyToManyTableName: function(name1, name2) {
        var _name1 =  name1[0].toUpperCase() + name1.replace(/^./, "")
        var _name2 =  name2[0].toUpperCase() + name2.replace(/^./, "")

        return [_name1, _name2].sort().join("")
      },

      asTableIdentifier: function(name) {
        var _name = name[0].toLowerCase() + name.replace(/^./, "")
        return _name + "Id"; //Helper.Inflection.singularize(_name) + "Id"
      },

      addPrefix: function(prefix, string, singularize) {
        var _string = string; //singularize ? Helper.Inflection.singularize(string) : Helper.Inflection.pluralize(string)
        return prefix + _string[0].toUpperCase() + _string.replace(/^./, "")
      },

      asTableName: function(name) {
        return name; //Helper.Inflection.pluralize(name)
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

        Helper.Hash.forEach(actualValues, function(value, key) {
          var dataType  = object.table.attributes[key]
          result.push(Helper.SQL.transformValueByDataType(value, dataType))
        })

        return result
      },

      valuesForUpdate: function(object, options) {
        var actualValues = object.values,
            result  = []

        options = options || {}

        Helper.Hash.forEach(actualValues, function(value, key) {
          var dataType  = object.table.attributes[key]
          result.push([key, Helper.SQL.transformValueByDataType(value, dataType)].join(" = "))
        })

        return result.join(options.seperator || ", ")
      },

      fieldsForInsertQuery: function(object) {
        return Helper.Hash.keys(object.values).join(", ")
      },

      transformValueByDataType: function(value, attributeOptions) {
        var dataType = attributeOptions.type
        
        if((value == null)||(typeof value == 'undefined')||((dataType.indexOf(Sequelize.INTEGER) > -1) && isNaN(value)))
          return "NULL"

        if(dataType.indexOf(Sequelize.FLOAT) > -1)
          return (typeof value == 'number') ? value : parseFloat(value.replace(",", "."))

        if(dataType.indexOf(Sequelize.BOOLEAN) > -1)
          return (value === true ? 1 : 0)

        if(dataType.indexOf(Sequelize.INTEGER) > -1)
          return value

        if(dataType.indexOf(Sequelize.DATE) > -1)
          return ("'" + Helper.SQL.asSqlDate(value) + "'")

        return ("'" + value + "'")
      },

      hashToWhereConditions: function(conditions, attributes) {
        if(typeof conditions == 'number')
          return ('id = ' + conditions)
        else {
          var result = []
          Helper.Hash.forEach(conditions, function(value, key) {
            var _value = Helper.SQL.transformValueByDataType(value, attributes[key])
            if(_value == 'NULL') result.push(key + " IS NULL")
            else result.push(key + "=" + _value)
          })
          return result.join(" AND ")
        }
      }
    },

    Hash: {
      forEach: function(object, func) {
        Helper.Hash.keys(object).forEach(function(key) {
          func(object[key], key, object)
        })
      },

      map: function(object, func) {
        var result = []
        Helper.Hash.forEach(object, function(value, key, object) {
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
        Helper.Hash.keys(object).forEach(function(key) {
          result.push(object[key])
        })
        return result
      },

      merge: function(source, target, force) {
        Helper.Hash.forEach(source, function(value, key) {
          if(!target[key] || force)
            target[key] = value
        })
        return target
      },
      without: function(object, withoutKeys) {
        var result = {}
        Helper.Hash.forEach(object, function(value, key) {
          if(withoutKeys.indexOf(key) == -1)
            result[key] = value
        })
        return result
      }
    },
    Array: {
      map: function(array, func) {
        var result = []
        array.forEach(function(element) {
          result.push(func(element))
        })
        return result
      },
      reject: function(array, func) {
        var result = []
        array.forEach(function(element) {
          if(!func(element)) result.push(element)
        })
        return result
      },
      select: function(array, func) {
        var result = []
        array.forEach(function(element) {
          if(func(element)) result.push(element)
        })
        return result
      },
      without: function(array, withouts) {
        var result = []
        array.forEach(function(e) {
          if(withouts.indexOf(e) == -1) result.push(e)
        })
        return result
      },
      join: function(arr1, arr2) {
        var result = []
        arr1.forEach(function(e) { result.push(e) })
        arr2.forEach(function(e) { result.push(e) })
        return result
      }
    },

    Inflection: require(__dirname + "/../inflection/inflection")
  }
  
  return Helper
}
