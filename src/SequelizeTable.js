SequelizeTable = function(sequelize, tableName, attributes) {
  var table = function(values) {
    var self = this
    SequelizeHelper.Hash.forEach(values, function(value, key) {
      if(attributes[key])
        self[key] = value
    })
    this.id = null // specify id as null to declare this object as unsaved and as not present in the database
    this.table = table
  }
  
  // class methods
  var classMethods = {
    associations: [],
    attributes: attributes,
    tableName: tableName,
    
    isCrossAssociatedWith: function(_table) {
      var result = false
      _table.associations.forEach(function(association) {
        if((association.table.tableName == table.tableName) && (association.type == 'hasMany'))
          result = true
      })
      return result
    },
    
    sync: function(callback) {
      table.associations.forEach(function(association) {
        switch(association.type) {
          case 'hasMany':
            if(association.table.isCrossAssociatedWith(association.table)) {
              // many to many relation
              
            } else {
              // one to many relation
              association.table.attributes[table.identifier] = Sequelize.INTEGER
            }
            
            break
          case 'hasOne':
            // e.g. assocTable.myTableId = Sequelize.INTEGER
            association.table.attributes[table.identifier] = Sequelize.INTEGER
            break
          case 'belongsTo':
            // e.g. table.dayId = Sequelize.INTEGER
            table.attributes[table.identifier] = Sequelize.INTEGER
            break
        }
      })

      var fields = ["id INT NOT NULL auto_increment PRIMARY KEY"]
      SequelizeHelper.Hash.forEach(table.attributes, function(type, name) {
        fields.push(name + " " + type)
      })

      sequelize.query(
        Sequelize.sqlQueryFor( 'create', { table: table.tableName, fields: fields.join(', ') } ),
        function() { if(callback) callback(table) }
      )
    },

    drop: function(callback) {
      sequelize.query(
        Sequelize.sqlQueryFor('drop', { table: table.tableName }),
        function() { if(callback) callback(table) }
      )
    },

    // TODO: mysql library currently doesn't support MYSQL_DATE!!! look for fix
    findAll: function(options, callback) {
      // use the first param as callback if it is no object (hash)
      var _callback = (typeof options == 'object') ? callback : options
      var queryOptions = (typeof options == 'object')
        ? SequelizeHelper.Hash.merge(options, { table: table.tableName })
        : { table: table.tableName }

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
          table: table.tableName,
          where: SequelizeHelper.SQL.hashToWhereConditions(conditions, table.attributes),
          order: 'id DESC',
          limit: 1
        }), function(result) {
          var _result = result[0] ? table.sqlResultToObject(result[0]) : null
          if (callback) callback(_result)
        }
      )
    },

    // TODO: mysql library currently doesn't support MYSQL_DATE!!! don't merge if fixed
    sqlResultToObject: function(result) {
      if(typeof result == undefined) return null
      
      var object = new table(SequelizeHelper.Hash.merge({createdAt: new Date(), updatedAt: new Date()}, result, true))
      object.id = result.id
      return object
    },
    
    hasMany: function(assocName, _table) {
      table.associations.push({
        name: assocName,
        table: _table,
        type: 'hasMany'
      })
      
      table.prototype[assocName] = function(callback) {
        var whereConditions = [table.identifier, this.id].join("=")
        _table.findAll({where: whereConditions}, callback)
      }
      
      return table
    },
    
    hasOne: function(assocName, _table) {
      table.associations.push({
        name: assocName,
        table: _table,
        type: 'hasOne'
      })
      
      table.prototype[assocName] = function(callback) {
        var whereConditions = {}
        whereConditions[table.identifier] = this.id
        _table.find(whereConditions, callback)
      }
      
      return table
    },
    
    belongsTo: function(assocName, _table) {
      table.associations.push({
        name: assocName,
        table: _table,
        type: 'belongsTo'
      })
      
      table.prototype[assocName] = function(callback) {
        var whereConditions = ["id", this[_table.identifier]].join("=")
        _table.find({where: whereConditions}, callback)
      }
      
      return table
    }
  }
  // don't put this into the hash!
  classMethods.identifier = SequelizeHelper.SQL.asTableIdentifier(classMethods.tableName)
  
  // instance methods
  table.prototype = {
    get values() {
      var result = {}
      var self = this

      SequelizeHelper.Hash.keys(table.attributes).forEach(function(attribute) {
        result[attribute] = self[attribute]
      })

      return result
    },
    
    save: function(callback) {
      var query = null
      var self = this

      this.updatedAt = new Date()
      if(this.id == null) {
        this.createdAt = new Date()
        query = Sequelize.sqlQueryFor('insert', {
          table: table.tableName, fields: SequelizeHelper.SQL.fieldsForInsertQuery(this), values: SequelizeHelper.SQL.valuesForInsertQuery(this)
        })
      } else
        query = Sequelize.sqlQueryFor('update', { table: table.tableName, values: SequelizeHelper.SQL.valuesForUpdate(this), id: this.id })
      
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
      SequelizeHelper.Hash.keys(table.attributes).forEach(function(attribute) {
        if(newValues[attribute])
          self[attribute] = newValues[attribute]
      })
      this.save(callback)
    },
    
    destroy: function(callback) {
      sequelize.query(
        Sequelize.sqlQueryFor('delete', { table: table.tableName, id: this.id }),
        callback
      )
    }
  }
  
  SequelizeHelper.Hash.forEach(classMethods, function(method, methodName) {
    table[methodName] = method
  })
  
  return table
}