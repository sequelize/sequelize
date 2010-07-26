SequelizeTable = function(sequelize, tableName, attributes) {
  var table = function(values) {
    var self = this
    SequelizeHelper.Hash.forEach(values, function(value, key) {
      if(attributes[key])
        self[key] = value
    })
    this.id = null // specify id as null to declare this object as unsaved and as not present in the database
    this.tableName = tableName
    this.attributes = attributes
  }
  
  // class methods
  var classMethods = {
    sync: function(callback) {
      var fields = ["id INT NOT NULL auto_increment PRIMARY KEY"]
      SequelizeHelper.Hash.keys(attributes).forEach(function(name) { fields.push(name + " " + attributes[name]) })

      sequelize.query(
        Sequelize.sqlQueryFor( 'create', { table: tableName, fields: fields.join(', ') } ),
        function() { if(callback) callback(table) }
      )
    },

    drop: function(callback) {
      var query = "DROP TABLE IF EXISTS " + tableName
      sequelize.query(
        Sequelize.sqlQueryFor('drop', { table: tableName }),
        function() { if(callback) callback(table) }
      )
    },

    // TODO: mysql library currently doesn't support MYSQL_DATE!!! look for fix
    findAll: function(options, callback) {
      // use the first param as callback if it is no object (hash)
      var _callback = (typeof options == 'object') ? callback : options
      var queryOptions = (typeof options == 'object') ? SequelizeHelper.Hash.merge(options, { table: tableName }) : { table: tableName }

      sequelize.query(
        Sequelize.sqlQueryFor('select', queryOptions),
        function(result) {
          var objects = []

          result.forEach(function(resultSet) {
            objects.push(table.sqlResultToObject(resultSet))

          })
        
          if(_callback) _callback(objects)
        }
      )
    },

    find: function(conditions, callback) {
      sequelize.query(
        Sequelize.sqlQueryFor('select', {
          table: tableName, where: SequelizeHelper.SQL.hashToWhereConditions(conditions, this.attributes), order: 'id DESC', limit: 1
        }), function(result) {
          if (callback) callback(table.sqlResultToObject(result[0]))
        }
      )
    },

    // TODO: mysql library currently doesn't support MYSQL_DATE!!! don't merge if fixed
    sqlResultToObject: function(result) {
      var object = new table(SequelizeHelper.Hash.merge({createdAt: new Date(), updatedAt: new Date()}, result, true))
      object.id = result.id
      return object
    }
  }
  
  // instance methods
  table.prototype = {
    get values() {
      var result = {}
      var self = this

      SequelizeHelper.Hash.keys(attributes).forEach(function(attribute) {
        result[attribute] = self[attribute]
      })

      return result
    },
    
    save: function(callback) {
      var query = null
      var self = this

      this.updateAt = new Date()
      if(this.id == null) {
        this.createdAt = new Date()
        query = Sequelize.sqlQueryFor('insert', {
          table: this.tableName, fields: SequelizeHelper.SQL.fieldsForInsertQuery(this), values: SequelizeHelper.SQL.valuesForInsertQuery(this)
        })
      } else
        query = Sequelize.sqlQueryFor('update', { table: this.tableName, values: SequelizeHelper.SQL.valuesForUpdate(this), id: this.id })
      
      sequelize.query(query, function() {
        if(self.id == null) {
          table.find(self.values, function(result) {
            self.id = result.id
            if(callback) callback(self)
          })
        } else {
          if(callback) callback(self)
        }
      })
    },
    
    updateAttributes: function(newValues, callback) {
      var self = this
      SequelizeHelper.Hash.keys(this.attributes).forEach(function(attribute) {
        if(newValues[attribute])
          self[attribute] = newValues[attribute]
      })
      this.save(callback)
    },
    
    destroy: function(callback) {
      sequelize.query(
        Sequelize.sqlQueryFor('delete', { table: this.tableName, id: this.id }),
        callback
      )
    }
  }
  
  SequelizeHelper.Hash.forEach(classMethods, function(method, methodName) {
    table[methodName] = method
  })
  
  return table
}