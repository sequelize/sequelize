/*
  A.hasOne(B)                 => B.aId
  A.belongsTo(B)              => A.bId
  A.hasMany(B)                => B.aId
  A.hasMany(B) + B.hasMany(A) => AB.aId + AB.bId
*/

exports.SequelizeTable = function(Sequelize, sequelize, tableName, attributes, options) {
  options = options || {}
  options.classMethods = options.classMethods || {}
  options.instanceMethods = options.instanceMethods || {}
  
  var table = function(values) {
    var self = this,
        defaults = {}
        
    // read all default values ...
    Sequelize.Helper.Hash.forEach(table.attributes, function(options, key) {
      if(typeof options.default != 'undefined') defaults[key] = options.default
    })

    // and merge them into the passed one
    Sequelize.Helper.Hash.merge(defaults, values)
    
    // now iterate over the values and assign them the current object
    Sequelize.Helper.Hash.forEach(values, function(value, key) {
      if(attributes[key]) {
        if(attributes[key].type.indexOf(Sequelize.BOOLEAN) > -1)
          self[key] = ((value == 1) || (value == true)) ? true : false
        else if(attributes[key].type.indexOf(Sequelize.DATE) > -1)
          self[key] = (value instanceof Date) ? value : new Date(Date.parse(value))
        else
          self[key] = value
      }
    })
    
    this.id = null // specify id as null to declare this object as unsaved and as not present in the database
    this.table = table
  }
  
  // class methods
  var classMethods = {
    associations: [],
    attributes: attributes,
    tableName: tableName,
    
    prepareAssociations: function(callback) {
      table.associations.forEach(function(association) {
        var assocNameAsTableIdentifier = Sequelize.Helper.SQL.asTableIdentifier(association.name)

        switch(association.type) {
          case 'hasMany':
            if(association.backAssociationName) {
              // many to many relation
              var _attributes = {}
              _attributes[assocNameAsTableIdentifier] = Sequelize.INTEGER
              _attributes[Sequelize.Helper.SQL.asTableIdentifier(association.backAssociationName)] = Sequelize.INTEGER
              sequelize.define(Sequelize.Helper.SQL.manyToManyTableName(association.name, association.backAssociationName), _attributes)
            } else {
              // one to many relation
              association.table.attributes[assocNameAsTableIdentifier] = {type: Sequelize.INTEGER}
            }
            break
          case 'hasOne':
            // e.g. assocTable.myTableId = Sequelize.INTEGER
            association.table.attributes[assocNameAsTableIdentifier] = {type: Sequelize.INTEGER}
            break
          case 'belongsTo':
            // e.g. table.dayId = Sequelize.INTEGER
            table.attributes[assocNameAsTableIdentifier] = {type :Sequelize.INTEGER}
            break
        }
      })
      if(callback) callback()
    },
    
    /* returns: table, error */
    sync: function(callback) {
      var fields = ["id INT NOT NULL auto_increment PRIMARY KEY"]
      Sequelize.Helper.Hash.forEach(table.attributes, function(options, name) {
        fields.push(name + " " + options.type)
      })

      sequelize.query(
        Sequelize.sqlQueryFor( 'create', { table: table.tableName, fields: fields.join(', ') } ),
        function(_, _, err) { if(callback) callback(table, err) }
      )
    },

    drop: function(callback) {
      sequelize.query(
        Sequelize.sqlQueryFor('drop', { table: table.tableName }),
        function(_, _, err) { if(callback) callback(table, err) }
      )
    },

    findAll: function(options, callback) {
      // use the first param as callback if it is no object (hash)
      var _callback = (typeof options == 'object') ? callback : options
      var queryOptions = (typeof options == 'object')
        ? Sequelize.Helper.Hash.merge(options, { table: table.tableName })
        : { table: table.tableName }

      sequelize.query(
        Sequelize.sqlQueryFor('select', queryOptions),
        function(result) {
          var objects = Sequelize.Helper.Array.map(result, function(r) { return table.sqlResultToObject(r) })
          if(_callback) _callback(objects)
        }
      )
    },

    find: function(conditions, callback) {
      sequelize.query(
        Sequelize.sqlQueryFor('select', {
          table: table.tableName,
          where: Sequelize.Helper.SQL.hashToWhereConditions(conditions, table.attributes),
          order: 'id DESC',
          limit: 1
        }), function(result) {
          var _result = result[0] ? table.sqlResultToObject(result[0]) : null
          if (callback) callback(_result)
        }
      )
    },

    sqlResultToObject: function(result) {
      if(typeof result == undefined) return null

      var object = new table(result)
      object.id = result.id
      return object
    },
    
    hasMany: function(assocName, _table, backAssocName) {
      var Factory = new require("./Factory").Factory(Sequelize, sequelize)
      
      table.associations.push({
        name: assocName,
        backAssociationName: backAssocName,
        table: _table,
        type: 'hasMany'
      })
      
      // don't check inside of method to increase performance
      if(backAssocName) {
        table.prototype[Sequelize.Helper.SQL.addPrefix('get', assocName)] = Factory.createManyToManyGetter(table, _table, assocName, backAssocName)
        table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = Factory.createManyToManySetter(table, _table, assocName, backAssocName)
        _table.prototype[Sequelize.Helper.SQL.addPrefix('get', backAssocName)] = Factory.createManyToManyGetter(_table, table, backAssocName, assocName)
        _table.prototype[Sequelize.Helper.SQL.addPrefix('set', backAssocName)] = Factory.createManyToManySetter(_table, table, backAssocName, assocName)
      } else {
        table.prototype[Sequelize.Helper.SQL.addPrefix('get', assocName)] = Factory.createOneToManyGetter(table, _table, assocName)
        table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = Factory.createOneToManySetter(table, assocName)
      }
      
      return table
    },
    
    hasOne: function(assocName, _table) {
      table.associations.push({
        name: assocName,
        table: _table,
        type: 'hasOne'
      })
      
      table.prototype[Sequelize.Helper.SQL.addPrefix('get', assocName)] = function(callback) {
        var whereConditions = {}
        whereConditions[table.identifier] = this.id
        _table.find(whereConditions, callback)
      }
      
      table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = function(object, callback) {
        var self = this
        
        this[Sequelize.Helper.SQL.addPrefix('get', assocName)](function(currentAssociation) {
          var attr = {}
          if(currentAssociation == null) {
            attr[table.identifier] = self.id
            object.updateAttributes(attr, callback)
          } else {
            if(object.id == currentAssociation.id) callback()
            else {
              attr[table.identifier] = null
              currentAssociation.updateAttributes(attr, function() {
                attr[table.identifier] = self.id
                object.updateAttributes(attr, callback)
              })
            }
          }
        })
      }
      
      return table
    },
    
    belongsTo: function(assocName, _table) {
      table.associations.push({
        name: assocName,
        table: _table,
        type: 'belongsTo'
      })
      
      table.prototype[Sequelize.Helper.SQL.addPrefix('get', assocName)] = function(callback) {
        if((this[_table.identifier] == null)||(isNaN(this[_table.identifier])))
          callback([])
        else
          _table.find(this[_table.identifier], callback)
      }
      
      table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = function(object, callback) {
        var attr = {}; attr[object.table.identifier] = object.id
        var self = this
        this.updateAttributes(attr, function() {
          self[Sequelize.Helper.SQL.addPrefix('get', assocName)](callback)
        })
      }
      
      return table
    }
  }
  // don't put this into the hash!
  classMethods.identifier = Sequelize.Helper.SQL.asTableIdentifier(classMethods.tableName)
  
  // instance methods
  table.prototype = {
    get values() {
      var result = {}
      var self = this

      Sequelize.Helper.Hash.keys(table.attributes).forEach(function(attribute) {
        result[attribute] = (typeof self[attribute] == "undefined") ? null : self[attribute]
      })

      return result
    },
    
    get invalidFields() {
      var result  = [],
          self    = this
      
      Sequelize.Helper.Hash.forEach(table.attributes, function(options, attribute) {
        if(['createdAt', 'updatedAt'].indexOf(attribute) > -1) return
        
        var allowsNull = ((typeof options.allowNull == 'undefined') || (options.allowNull !== false))
        var hasDefault = (typeof options.default != 'undefined')

        if(!allowsNull && !hasDefault && (typeof self[attribute] == 'undefined'))
          result.push({ field: attribute, reason: 'The field does not allow NULL values and has no default!'})
      })
      
      return result
    },
    
    get isValid() {
      return this.invalidFields.length == 0
    },
    
    save: function(callback) {
      var query = null,
          self = this

      if(!this.isValid) {
        var errorText = "The object is not valid! Invalid fields: " + Sequelize.Helper.Array.map(this.invalidFields, function(fieldHash) { return fieldHash.field }).join(", ")
        throw new Error(errorText)
      }

      this.updatedAt = new Date()
      if(this.id == null) {
        this.createdAt = new Date()
        
        query = Sequelize.sqlQueryFor('insert', {
          table: table.tableName,
          fields: Sequelize.Helper.SQL.fieldsForInsertQuery(this),
          values: Sequelize.Helper.SQL.valuesForInsertQuery(this)
        })
      } else {
        query = Sequelize.sqlQueryFor('update', { table: table.tableName, values: Sequelize.Helper.SQL.valuesForUpdate(this), id: this.id })
      }
      
      sequelize.query(query, function(result, stats) {
        self.id = self.id || stats.insert_id
        if(callback) callback(self)
      })
    },
    
    updateAttributes: function(newValues, callback) {
      var self = this
      Sequelize.Helper.Hash.keys(table.attributes).forEach(function(attribute) {
        if(typeof newValues[attribute] != 'undefined')
          self[attribute] = newValues[attribute]
      })

      this.save(callback)
    },
    
    destroy: function(callback) {
      sequelize.query(
        Sequelize.sqlQueryFor('delete', { table: table.tableName, where: ['id', this.id].join("=") }),
        callback
      )
    }
  }
  
  // merge classMethods + passed classMethods
  Sequelize.Helper.Hash.merge(options.classMethods, classMethods)
  Sequelize.Helper.Hash.forEach(classMethods, function(method, methodName) { 
    table[methodName] = method
  })
  
  // merge passed instanceMethods
  Sequelize.Helper.Hash.forEach(options.instanceMethods, function(method, methodName) {
    table.prototype[methodName] = method
  })
  
  return table
}