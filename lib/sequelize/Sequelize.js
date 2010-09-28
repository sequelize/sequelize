var Sequelize = function(database, username, password, options) {
  options = options || {}
  this.config = {
    database: database,
    username: username,
    password: (((["", null, false].indexOf(password) > -1) || (typeof password == 'undefined')) ? null : password),
    host    : options.host || 'localhost',
    port    : options.port || 3306
  }
  this.tables = {}
  this.options = Sequelize.Helper.Hash.without(options, ["host", "port"])
}

var classMethods = {
  Helper: new require(__dirname + "/Helper").Helper(Sequelize),

  STRING: 'VARCHAR',
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
        query = "UPDATE %{table} SET %{values} WHERE %{where}"
        break
      case 'copy':
        query = "INSERT INTO %{history_table} (%{fields}) (SELECT %{fields} FROM %{table} WHERE %{where})"
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
    var _attributes = {}
    var options=options || {};

    options.timestamps = typeof(options.timestamps)=='undefined'?true:options.timestamps;
    Sequelize.Helper.Hash.forEach(attributes, function(value, key) {
      if(typeof value == 'string')
        _attributes[key] = { type: value, size: 255 }
      else if((typeof value == 'object') && (!value.length))
        _attributes[key] = value
      else
        throw new Error("Please specify a datatype either by using Sequelize.* or pass a hash!")
    })
    
    var table = new SequelizeTable(Sequelize, this, Sequelize.Helper.SQL.asTableName(name), _attributes, options)
    if (options.trackChanges) {
      options = Sequelize.Helper.Hash.without(options,['primaryKey','timestamps']); // creates a new ID field for history
      _attributes = Sequelize.Helper.Hash.without(_attributes,['createdAt','deletedAt']);
      _attributes.updatedAt = { type: Sequelize.DATE, allowNull: false};
      table.historyTable=new SequelizeTable(Sequelize, this, Sequelize.Helper.SQL.asTableName(name+"_history"), _attributes, options);
    }
    
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
  
  queryTransaction: function(queryString, callback) {
    return this.query(queryString,callback,true);
  },
  query: function(queryString, callback,transaction) {
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
        if(!self.options.disableLogging) {
          //Sequelize.Helper.log("Executing the query: " + queryString)
          console.log("Executing the query: " + queryString)
        }
        //if (transaction) client.query('BEGIN');
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
       // if (transaction) {
        //  client.query('END');
        //  client.query('COMMIT');
        //}
        client.close()
      })
  }
}

for (var key in classMethods) Sequelize[key] = classMethods[key]

exports.Sequelize = Sequelize
