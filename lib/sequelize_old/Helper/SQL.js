module.exports = function(instance) {
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
        var dataType  = object.table.attributes[key],
            _key      = ['', key, ''].join('`')
        result.push([_key, self.SQL.transformValueByDataType(value, dataType)].join(" = "))
      })

      return result.join(options.seperator || ", ")
    },

    fieldsForInsertQuery: function(object) {
      return instance.Hash.keys(object.values).map(function(value) {
        return ['', value, ''].join('`')
      }).join(", ")
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
    
    getDataTypeForValue: function(value) {
      switch(typeof value) {
        case 'number':
          return (value.toString().indexOf('.') > -1) ? instance.Sequelize.FLOAT : instance.Sequelize.INTEGER
          break
        case 'boolean':
          return instance.Sequelize.BOOLEAN
          break
        case 'object':
          return (value.getMilliseconds) ? instance.Sequelize.DATE : "WTF!"
          break
        default: 
          return instance.Sequelize.TEXT
          break
      }
    },

    hashToWhereConditions: function(conditions, attributes) {
      attributes = attributes || {}
      
      if(typeof conditions == 'number')
        return ('`id`=' + conditions)
      else {
        return instance.Hash.map(conditions, function(value, key) {
          var dataType = attributes[key] || {type:instance.SQL.getDataTypeForValue(value)},
              _value   = instance.SQL.transformValueByDataType(value, dataType),
              _key     = ['', key, ''].join('`')
                    
          if(_value == 'NULL')
            return _key + " IS NULL"
          else
            return [_key, _value].join("=")
        }).join(" AND ")
      }
    }
  }
}