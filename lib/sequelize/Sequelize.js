var Sequelize = function(database, username, password, options) {
  options = options || {}

  this.tables = {}
  this.options = Sequelize.Helper.Hash.without(options, ["host", "port", "disableTableNameModification"])
  this.config = {
    database: database,
    username: username,
    password: (((["", null, false].indexOf(password) > -1) || (typeof password == 'undefined')) ? null : password),
    host    : options.host || 'localhost',
    port    : options.port || 3306
  }

  Sequelize.Helper.configure({
    disableTableNameModification: (options.disableTableNameModification || false)
  })
}

var classMethods = {
  Helper: new (require(__dirname + "/Helper").Helper)(Sequelize),

  STRING: 'VARCHAR(255)',
  TEXT: 'TEXT',
  INTEGER: 'INT',
  DATE: 'DATETIME',
  BOOLEAN: 'TINYINT(1)',
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
  chainQueries: function() {
    var QueryChainer = require("./QueryChainer").QueryChainer,
        queryChainer = new QueryChainer(Sequelize.Helper)
    
    queryChainer.chain.apply(queryChainer, arguments)
  }
}

Sequelize.prototype = {
  define: function(name, attributes, options) {
    var SequelizeTable = require(__dirname + "/SequelizeTable").SequelizeTable
    var _attributes = {}
    
    Sequelize.Helper.Hash.forEach(attributes, function(value, key) {
      if(typeof value == 'string')
        _attributes[key] = { type: value }
      else if((typeof value == 'object') && (!value.length))
        _attributes[key] = value
      else
        throw new Error("Please specify a datatype either by using Sequelize.* or pass a hash!")
    })
    
    _attributes.createdAt = { type: Sequelize.DATE, allowNull: false}
    _attributes.updatedAt = { type: Sequelize.DATE, allowNull: false}
    
    var table = new SequelizeTable(Sequelize, this, Sequelize.Helper.SQL.asTableName(name), _attributes, options)
    
    // refactor this to use the table's attributes
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
    var fields = [],
        values = [],
        self   = this,
        client = require(__dirname + "/../nodejs-mysql-native/index").createTCPClient(this.config.host, this.config.port)
    
    client.connection.on('error', function() {
      callback(null, null, { message: "Unable to establish a connection to " + [self.config.host, self.config.port].join(":") })
    })
    
    client.auto_prepare = true
    client
      .auth(self.config.database, self.config.username, self.config.password)
      .on('error', function(err) { callback(null, null, err) })
      .on('authorized', function() {
        if(!self.options.disableLogging)
          Sequelize.Helper.log("Executing the query: " + queryString)

        client
          .query(queryString)
          .on('error', function(err) { Sequelize.Helper.log(err) })
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
        client.close()
      })
  }
}

for (var key in classMethods) Sequelize[key] = classMethods[key]

exports.Sequelize = Sequelize