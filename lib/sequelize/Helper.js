var injectSQL = function(instance) {
  instance.SQL = {
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
      return instance.Inflection.singularize(_name) + "Id"
    },

    addPrefix: function(prefix, string, singularize) {
      var _string = singularize ? instance.Inflection.singularize(string) : instance.Inflection.pluralize(string)
      return prefix + _string[0].toUpperCase() + _string.replace(/^./, "")
    },

    asTableName: function(name) {
      return instance.options.disableTableNameModification
        ? name
        : instance.Inflection.pluralize(name)
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

      instance.Hash.forEach(actualValues, function(value, key) {
        var dataType  = object.table.attributes[key]
        result.push(instance.SQL.transformValueByDataType(value, dataType))
      })

      return result
    },

    valuesForUpdate: function(object, options) {
      var actualValues = object.values,
          result  = [],
          self    = instance

      options = options || {}

      instance.Hash.forEach(actualValues, function(value, key) {
        var dataType  = object.table.attributes[key]
        result.push([key, self.SQL.transformValueByDataType(value, dataType)].join(" = "))
      })

      return result.join(options.seperator || ", ")
    },

    fieldsForInsertQuery: function(object) {
      return instance.Hash.keys(object.values).join(", ")
    },

    transformValueByDataType: function(value, attributeOptions) {
      var dataType = attributeOptions.type

      if((value == null)||(typeof value == 'undefined')||((dataType.indexOf(instance.Sequelize.INTEGER) > -1) && isNaN(value)))
        return "NULL"

      if(dataType.indexOf(instance.Sequelize.FLOAT) > -1)
        return (typeof value == 'number') ? value : parseFloat(value.replace(",", "."))

      if(dataType.indexOf(instance.Sequelize.BOOLEAN) > -1)
        return (value === true ? 1 : 0)

      if(dataType.indexOf(instance.Sequelize.INTEGER) > -1)
        return value

      if(dataType.indexOf(instance.Sequelize.DATE) > -1)
        return ("'" + instance.SQL.asSqlDate(value) + "'")

      return ("'" + value + "'")
    },

    hashToWhereConditions: function(conditions, attributes) {
      if(typeof conditions == 'number')
        return ('id = ' + conditions)
      else {
        var result = []
        instance.Hash.forEach(conditions, function(value, key) {
          var _value = instance.SQL.transformValueByDataType(value, attributes[key])
          if(_value == 'NULL') result.push(key + " IS NULL")
          else result.push(key + "=" + _value)
        })
        return result.join(" AND ")
      }
    }
  }
}
var injectHash = function(instance) {
  instance.Hash = {
    forEach: function(object, func) {
      instance.Hash.keys(object).forEach(function(key) {
        func(object[key], key, object)
      })
    },

    map: function(object, func) {
      var result = []
      instance.Hash.forEach(object, function(value, key, object) {
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
      instance.Hash.keys(object).forEach(function(key) {
        result.push(object[key])
      })
      return result
    },

    merge: function(source, target, force) {
      instance.Hash.forEach(source, function(value, key) {
        if(!target[key] || force)
          target[key] = value
      })
      return target
    },
    without: function(object, withoutKeys) {
      var result = {}
      instance.Hash.forEach(object, function(value, key) {
        if(withoutKeys.indexOf(key) == -1)
          result[key] = value
      })
      return result
    }
  }
}
var injectArray = function(instance) {
  instance.Array = {
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
  }
}
var injectBasics = function(instance) {
  instance.configure = function(options) {
    this.options = options
  }

  instance.log = function(obj) {
    var sys = require("sys")
    sys.log(sys.inspect(obj))
  }

  instance.evaluateTemplate = function(template, replacements) {
    var result = template
    this.Hash.keys(replacements).forEach(function(key) {
      result = result.replace("%{" + key + "}", replacements[key])
    })
    return result
  }
}
var Helper = function(Sequelize) {
  this.Sequelize = Sequelize
  this.Inflection = require(__dirname + "/../inflection/inflection")
  this.options = {}

  injectBasics(this)
  injectSQL(this)
  injectHash(this)
  injectArray(this)
}

exports.Helper = Helper