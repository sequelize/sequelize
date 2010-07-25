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
      var query = "CREATE TABLE IF NOT EXISTS " + tableName + " (" + fields.join(', ') + ")"

      sequelize.query(query, function() {
        if(callback) callback(table)
      })
    },

    drop: function(callback) {
      var query = "DROP TABLE IF EXISTS " + tableName
      sequelize.query(query, function() {
        if(callback) callback(table)
      })
    },

    findAll: function(callback) {
      var query = "SELECT * FROM " + tableName
      sequelize.query(query, function(result) {
        var objects = []
        result.forEach(function(resultSet) {
          objects.push(table.sqlResultToObject(resultSet))
        })
        
        if(callback) callback(objects)
      })
    },

    find: function(conditions, callback) {
      var query = SequelizeHelper.evaluateTemplate(
        "SELECT * FROM %{table} WHERE %{conditions} ORDER BY id DESC LIMIT 1",
        { table: tableName, conditions: SequelizeHelper.SQL.hashToWhereConditions(conditions) }
      )
      
      sequelize.query(query, function(result) {
        if (callback) callback(table.sqlResultToObject(result[0]))
      })
    },
    
    sqlResultToObject: function(result) {
      var object = new table(result)
      object.id = result.id
      return object
    }
  }
  
  // instance methods
  var instanceMethods = {
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
      if(this.id == null) {
        query = SequelizeHelper.evaluateTemplate(
          "INSERT INTO %{table} (%{fields}) VALUES (%{values})",
          { table: this.tableName, fields: SequelizeHelper.SQL.fieldsForInsertQuery(this), values: SequelizeHelper.SQL.valuesForInsertQuery(this) }
        )
      } else {
        query = SequelizeHelper.evaluateTemplate(
          "UPDATE %{table} SET %{values} WHERE id = %{id}",
          { table: this.tableName, values: SequelizeHelper.SQL.valuesForUpdate(this), id: this.id }
        )
      }
      
      sequelize.query(query, function() {
        if(self.id == null) {
          table.find(self.values, function(result) {
            SequelizeHelper.log(result)
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
      
    }
  }
  
  SequelizeHelper.Hash.forEach(classMethods, function(method, methodName) {
    table[methodName] = method
  })

  SequelizeHelper.Hash.forEach(instanceMethods, function(method, methodName) {
    table.prototype[methodName] = method
  })
  
  return table
}