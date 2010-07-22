/*
  var sequelize = new require('sequelize').sequelize(database, username[, password])
  var Tag = sequelize.define('Tag', {title: sequelize.TEXT, createdAt: sequelize.DATE})
  var t = new Tag({title: 'Office-Stuff', createdAt: new Date()})
  t.save(function() {
    callback
  })
*/
var log = function(obj){ var sys = require("sys"); sys.puts(sys.inspect(obj)) }
var keys = function(object) {
  var results = []
  for (var property in object)
    results.push(property)
  return results
}
var values = function(object) {
  var result = []
  keys(object).forEach(function(key) {
    result.push(object[key])
  })
  return result
}
var evaluateTemplate = function(template, replacements) {
  var result = template
  keys(replacements).forEach(function(key) {
    result = result.replace("%{" + key + "}", replacements[key])
  })
  return result
}
var mysql = require(__dirname + "/lib/node-mysql/mysql")

exports.Sequelize = function(database, username, password) {
  this.STRING   = 'VARCHAR(255)'
  this.TEXT     = 'VARCHAR(4000)'
  this.INTEGER  = 'INT'
  
  this.config = {
    database: database,
    username: username,
    password: password
  }
  this.connection = new mysql.Connection('localhost', this.config.username, this.config.password, this.config.database)
  this.tables = {}
}

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
    return keys(this.tables)
  },
  
  query: function(queryString, callback) {
    log("Executing the query: " + queryString)
    this.connection.connect()
    this.connection.query(queryString)
  }
}

var TableWrapper = function(sequelize, tableName, attributes) {
  var table = function(values) {
    var self = this
    keys(values).forEach(function(key) {
      if(attributes[key])
        self[key] = values[key]
    })
    this.id = null // specify id as null to declare this object as unsaved and as not present in the database
    this.tableName = tableName
    this.attributes = attributes
  }
  
  table.sync = function() {
    var fields = ["id INT"]
    attributes.forEach(function(type, name) { fields.push(name + " " + type) })
    var query = "CREATE TABLE IF NOT EXISTS " + tableName + " (" + fields.join(', ') + ")"

    sequelize.query(query)
  }
  
  table.drop = function() {
    var query = "DROP TABLE IF EXISTS " + tableName
    sequelize.query(query)
  }
  
  table.prototype = {
    get values() {
      var result = {}
      var self = this
      keys(this.attributes).forEach(function(key) {
        result[key] = self[key]
      })
      return result
    },
    
    get valuesAsString() {
      var actualValues = this.values
      var values = []
      var self = this
      keys(this.values).forEach(function(key) {
        switch(self.attributes[key]) {
          case sequelize.INT: actualValues[key]; break;
          default "'" + actualValues[key] + "'"
        }
        var valueAsString = 
        values.push
      })
    }
    
    save: function() {
      var query = null
      if(this.id == null) {
        query = evaluateTemplate(
          "INSERT INTO %{table} (%{fields}) VALUES (%{values})",
          { table: this.tableName, fields: keys(this.values).join(", "), values: this.valuesAsString }
        )
      } else {
        
      }
      
      sequelize.query(query)
    }
  }
  
  return table
}