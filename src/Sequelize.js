var Sequelize = function(database, username, password, options) {
  this.config = {
    database: database,
    username: username,
    password: password
  }
  this.tables = {}
  this.options = options || {}
}

var classMethods = {
  Helper: new require(__dirname + "/Helper").Helper(Sequelize),

  STRING: 'VARCHAR(255)',
  TEXT: 'TEXT',
  INTEGER: 'INT',
  DATE: 'DATETIME',
  BOOLEAN: 'TINYINT(1) NOT NULL',
  FLOAT: 'FLOAT',
  
  sqlQueryFor: function(command, values) {
    var query = null
    switch(command) {
      case 'create':
        query = "CREATE TABLE IF NOT EXISTS %{table} (%{fields})"
        break
      case 'drop':
        query = "DROP TABLE IF EXISTS %{table}"
        break
      case 'select':
        values.fields = values.fields || "*"
        query = "SELECT %{fields} FROM %{table}"
        if(values.where) query += " WHERE %{where}"
        if(values.order) query += " ORDER BY %{order}"
        if(values.group) query += " GROUP BY %{group}"
        if(values.limit) {
          if(values.offset) query += " LIMIT %{offset}, %{limit}"
          else query += " LIMIT %{limit}"
        }
        break
      case 'insert':
        query = "INSERT INTO %{table} (%{fields}) VALUES (%{values})"
        break
      case 'update':
        query = "UPDATE %{table} SET %{values} WHERE id = %{id}"
        break
      case 'delete':
        query = "DELETE FROM %{table} WHERE %{where}"
        if(typeof values.limit == 'undefined') query += " LIMIT 1"
        
        break
    }
    
    return Sequelize.Helper.evaluateTemplate(query, values)
  },
  chainQueries: function(queries, callback) {
    // queries = [{method: object}, {method: object, params: [1,2,3]}, {method: object}]
    var executeQuery = function(index) {
      var queryHash = queries[index]
      var method = Sequelize.Helper.Array.without(Sequelize.Helper.Hash.keys(queryHash), "params")[0]
      var object = queryHash[method]
      var iterator = function() {
        if(queries.length > (index + 1)) executeQuery(index + 1)
        else if (callback) callback()
      }
      
      object[method].apply(object, Sequelize.Helper.Array.join(queryHash.params || [], [iterator]))
    }
    if(queries.length > 0) executeQuery(0)
    else if (callback) callback()
  }
}

Sequelize.prototype = {
  define: function(name, attributes, options) {
    var SequelizeTable = require(__dirname + "/SequelizeTable").SequelizeTable
    
    attributes.createdAt = 'DATETIME NOT NULL'
    attributes.updatedAt = 'DATETIME NOT NULL'
    
    var table = new SequelizeTable(Sequelize, this, Sequelize.Helper.SQL.asTableName(name), attributes, options)
    table.attributes = attributes
    this.tables[name] = {klass: table, attributes: attributes}

    table.sequelize = this
    return table
  },
  
  import: function(path) {
    var imported  = require(path),
        self      = this,
        result    = {} 
    
    Sequelize.Helper.Hash.forEach(imported, function(definition, functionName) {
      definition(Sequelize, self)
    })
    
    Sequelize.Helper.Hash.forEach(this.tables, function(constructor, name) {
      result[name] = constructor.klass
    })

    return result
  },
  
  get tableNames() {
    var result = []
    Sequelize.Helper.Hash.keys(this.tables).forEach(function(tableName) {
      result.push(Sequelize.Helper.SQL.asTableName(tableName))
    })
    return result
  },
  
  sync: function(callback) {
    var finished = [],
        tables = this.tables,
        errors = []

    Sequelize.Helper.Hash.forEach(tables, function(table) {
      table.klass.prepareAssociations()
    })

    if((Sequelize.Helper.Hash.keys(this.tables).length == 0) && callback)
      callback()
    else
      Sequelize.Helper.Hash.forEach(tables, function(table) {
        table.klass.sync(function(_, err) {
          finished.push(true)
          if(err) errors.push(err)
          if((finished.length == Sequelize.Helper.Hash.keys(tables).length) && callback)
            callback(errors)
        })
      })
  },
  
  drop: function(callback) {
    var finished = [],
        tables = this.tables,
        errors = []

    if((Sequelize.Helper.Hash.keys(tables).length == 0) && callback)
      callback()
    else
      Sequelize.Helper.Hash.forEach(tables, function(table, tableName) {
        table.klass.drop(function(_, err) {
          finished.push(true)
          if(err) errors.push(err)
          if((finished.length == Sequelize.Helper.Hash.keys(tables).length) && callback)
            callback(errors)
        })
      })
  },
  
  query: function(queryString, callback) {
    var fields = []
    var values = []
    var self = this
    var connection = require(__dirname + "/../lib/nodejs-mysql-native/client").createTCPClient()
    
    connection.auto_prepare = true
    connection
      .auth(this.config.database, this.config.username, this.config.password)
      .addListener("error", function(err) { callback(err) })
      .addListener('authorized', function() {
        if(!self.options.disableLogging)
          Sequelize.Helper.log("Executing the query: " + queryString)
        
        connection
          .query(queryString)
          .on('row', function(r){ values.push(r) })
          .on('field', function(f){ fields.push(f)})
          .on('end', function(stats) {
            if(callback) {
              var result = []
              values.forEach(function(valueArray) {
                var mapping = {}
                for(var i = 0; i < fields.length; i++)
                  mapping[fields[i].name] = valueArray[i]
                result.push(mapping)
              })
              if(callback) callback(result, stats)
            }
          })
        connection.close()
      })
  }
}

for (var key in classMethods) Sequelize[key] = classMethods[key]

exports.Sequelize = Sequelize