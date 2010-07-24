/*
  var sequelize = new require('sequelize').sequelize(database, username[, password])
  var Tag = sequelize.define('Tag', {title: sequelize.TEXT, createdAt: sequelize.DATE})
  var t = new Tag({title: 'Office-Stuff', createdAt: new Date()})
  t.save(function() {
    callback
  })
*/



exports.Sequelize = function(database, username, password) {
  this.config = {
    database: database,
    username: username,
    password: password
  }
  this.tables = {}
}

exports.Sequelize.STRING   = 'VARCHAR(255)'
exports.Sequelize.TEXT     = 'VARCHAR(4000)'
exports.Sequelize.INTEGER  = 'INT'

exports.Sequelize.prototype = {
  asTableName: function(name) {
    return name + "s"
  },
  
  define: function(name, attributes) {
    var table = new TableWrapper(this, this.asTableName(name), attributes)
    table.attributes = attributes
    this.tables[name] = {constructor: table, attributes: attributes}
    table.sequelize = this
    return table
  },
  
  get tableNames() {
    var result = []
    var self = this
    Helper.Hash.keys(this.tables).forEach(function(tableName) {
      result.push(self.asTableName(tableName))
    })
    return result
  },
  
  query: function(queryString, callback) {
    var fields = []
    var values = []
    var self = this
    var connection = require(__dirname+"/lib/nodejs-mysql-native/client").createTCPClient()
    
    connection.auto_prepare = true
    connection
      .auth(this.config.database, this.config.username, this.config.password)
      .addListener('authorized', function() {
        Helper.log("Executing the query: " + queryString)
        connection
          .execute(queryString)
          .addListener('row', function(r){ values.push(r) })
          .addListener('field', function(f){ fields.push(f)})
          .addListener('end', function() {
            if(callback) {
              var result = []
              values.forEach(function(valueArray) {
                var mapping = {}
                for(var i = 0; i < fields.length; i++)
                  mapping[fields[i].name] = valueArray[i]
                result.push(mapping)
              })
              callback(result)
            }
          })
        connection.close()
      })
  }
}

// table object

var TableWrapper = function(sequelize, tableName, attributes) {
  var table = function(values) {
    var self = this
    Helper.Hash.keys(values).forEach(function(key) {
      if(attributes[key]) {
        self[key] = values[key]
      }
    })
    this.id = null // specify id as null to declare this object as unsaved and as not present in the database
    this.tableName = tableName
    this.attributes = attributes
  }
  
  table.sync = function(callback) {
    var fields = ["id INT"]
    Helper.Hash.keys(attributes).forEach(function(name) { fields.push(name + " " + attributes[name]) })
    var query = "CREATE TABLE IF NOT EXISTS " + tableName + " (" + fields.join(', ') + ")"

    sequelize.query(query, callback)
  }
  
  table.drop = function(callback) {
    var query = "DROP TABLE IF EXISTS " + tableName
    sequelize.query(query, callback)
  }
  
  table.findAll = function(callback) {
    var query = "SELECT * FROM " + tableName
    sequelize.query(query, callback)
  }
  
  table.prototype = {
    save: function(callback) {
      var query = null

      if(this.id == null) {
        query = Helper.evaluateTemplate(
          "INSERT INTO %{table} (%{fields}) VALUES (%{values})",
          { table: this.tableName, fields: Helper.fieldsForInsertQuery(this), values: Helper.valuesForInsertQuery(this) }
        )
      } else {
        query = evaluateTemplate(
          "UPDATE %{table} SET %{values} WHERE id = %{id}",
          { table: this.tableName, values: Helper.valuesForUpdate(this), id: this.id }
        )
      }
      
      sequelize.query(query, callback)
    }
  }
  
  return table
}

// Helper methods

var Helper = {
  log: function(obj) {
    var sys = require("sys")
    sys.puts(sys.inspect(obj))
  },
  
  values: function(object) {
    var result = {}
    Helper.Hash.keys(object.attributes).forEach(function(key) {
      result[key] = object[key]
    })
    return result
  },
  
  valuesForInsertQuery: function(object) {
    var actualValues = Helper.values(object),
        result  = []
        
    Helper.Hash.keys(actualValues).forEach(function(key) {
      var value     = actualValues[key],
          dataType  = object.attributes[key]
          
      result.push(Helper.transformValueByDataType(value, dataType))
    })
    
    return result
  },
  
  fieldsForInsertQuery: function(object) {
    return Helper.Hash.keys(Helper.values(object)).join(", ")
  },
  
  transformValueByDataType: function(value, dataType) {
    var result = null
    switch(dataType) {
      case exports.Sequelize.INTEGER:
        result = value; break;
      default:
        result = "'" + value + "'"; break;
    }
    return result
  },
  
  valuesForUpdate: function(object) {
    var actualValues = Helper.values(object),
        result  = []
        
    Helper.Hash.keys(actualValues).forEach(function(key) {
      var value     = actualValues[key],
          dataType  = object.attributes[key]
          
      result.push([key, Helper.transformValueByDataType(value, dataType)].join(" = "))
    })
    
    return result.join(", ")
  },
  
  evaluateTemplate: function(template, replacements) {
    var result = template
    Helper.Hash.keys(replacements).forEach(function(key) {
      result = result.replace("%{" + key + "}", replacements[key])
    })
    return result
  },
  
  Hash: {
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
    }
  }
}

exports.SequelizeHelper = Helper