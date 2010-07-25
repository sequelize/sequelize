require(__dirname + "/SequelizeHelper")
require(__dirname + "/SequelizeTable")

Sequelize = function(database, username, password) {
  this.config = {
    database: database,
    username: username,
    password: password
  }
  this.tables = {}
}

var classMethods = {
  STRING: 'VARCHAR(255)',
  TEXT: 'VARCHAR(4000)',
  INTEGER: 'INT',
  sqlQueryFor: function(command, values) {
    var query = null
    switch(command) {
      case 'create':
        query = "CREATE TABLE IF NOT EXISTS %{table} (%{fields})"
        break;
    }
    return SequelizeHelper.evaluateTemplate(query, values)
  }
}

var instanceMethods = {
  asTableName: function(name) {
    return name + "s"
  },
  
  define: function(name, attributes) {
    var table = new SequelizeTable(this, this.asTableName(name), attributes)
    table.attributes = attributes
    this.tables[name] = {constructor: table, attributes: attributes}
    table.sequelize = this
    return table
  },
  
  get tableNames() {
    var result = []
    var self = this
    SequelizeHelper.Hash.keys(this.tables).forEach(function(tableName) {
      result.push(self.asTableName(tableName))
    })
    return result
  },
  
  query: function(queryString, callback) {
    var fields = []
    var values = []
    var self = this
    var connection = require(__dirname+"/../lib/nodejs-mysql-native/client").createTCPClient()
    
    connection.auto_prepare = true
    connection
      .auth(this.config.database, this.config.username, this.config.password)
      .addListener('authorized', function() {
        SequelizeHelper.log("Executing the query: " + queryString)
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

SequelizeHelper.Hash.forEach(classMethods, function(method, methodName) {
  Sequelize[methodName] = method
})

SequelizeHelper.Hash.forEach(instanceMethods, function(method, methodName) {
  Sequelize.prototype[methodName] = method
})