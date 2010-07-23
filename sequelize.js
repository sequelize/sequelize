/*
  var sequelize = new require('sequelize').sequelize(database, username[, password])
  var Tag = sequelize.define('Tag', {title: sequelize.TEXT, createdAt: sequelize.DATE})
  var t = new Tag({title: 'Office-Stuff', createdAt: new Date()})
  t.save(function() {
    callback
  })
*/

var mysql = require(__dirname + "/lib/node-mysql/mysql")

exports.Sequelize = function(database, username, password) {
  this.config = {
    database: database,
    username: username,
    password: password
  }
  this.connection = new mysql.Connection('localhost', this.config.username, this.config.password, this.config.database)
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
  
  query: function(queryString, options) {
    options = options || {}
    log("Executing the query: " + queryString)
    this.connection.connect()
    this.connection.query(queryString, options.onSuccess, options.onError)
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
  
  table.sync = function(options) {
    var fields = ["id INT"]
    Helper.Hash.keys(attributes).forEach(function(name) { fields.push(name + " " + attributes[name]) })
    var query = "CREATE TABLE IF NOT EXISTS " + tableName + " (" + fields.join(', ') + ")"

    sequelize.query(query, options)
  }
  
  table.drop = function(options) {
    var query = "DROP TABLE IF EXISTS " + tableName
    sequelize.query(query, options)
  }
  
  table.prototype = {
    save: function(options) {
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
      
      sequelize.query(query, options)
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
        result = "'" + value + "'"
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