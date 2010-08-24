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
    var self = this
    Sequelize.Helper.Hash.forEach(values, function(value, key) {
      if(attributes[key]) {
        if(attributes[key].indexOf(Sequelize.BOOLEAN) > -1)
          self[key] = ((value == 1) || (value == true)) ? true : false
        else if(attributes[key].indexOf(Sequelize.DATE) > -1)
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
    
    isAssociatedWith: function(anotherTable, associationType) {
      var result = false
      
      var associations = Sequelize.Helper.Array.select(table.associations, function(assoc) {
        return assoc.table.tableName == anotherTable.tableName
      })
      
      if(associations.length > 0) {
        if(associationType) result = (associations[0].type == associationType)
        else result = true
      }
      
      return result
    },
    
    isCrossAssociatedWith: function(anotherTable) {
      return table.isAssociatedWith(anotherTable, 'hasMany') && anotherTable.isAssociatedWith(table, 'hasMany')
    },
    
    prepareAssociations: function(callback) {
      table.associations.forEach(function(association) {
        switch(association.type) {
          case 'hasMany':
            if(association.table.isCrossAssociatedWith(table)) {
              // many to many relation
              var _attributes = {}
              _attributes[table.identifier] = Sequelize.INTEGER
              _attributes[association.table.identifier] = Sequelize.INTEGER
              sequelize.define(Sequelize.Helper.SQL.manyToManyTableName(table, association.table), _attributes)
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
            table.attributes[association.table.identifier] = Sequelize.INTEGER
            break
        }
      })
      if(callback) callback()
    },
    
    /* returns: table, error */
    sync: function(callback) {
      var fields = ["id INT NOT NULL auto_increment PRIMARY KEY"]
      Sequelize.Helper.Hash.forEach(table.attributes, function(type, name) {
        fields.push(name + " " + type)
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
    
    hasMany: function(assocName, _table) {
      table.associations.push({
        name: assocName,
        table: _table,
        type: 'hasMany'
      })
      
      // don't check inside of method to increase performance
      if(_table.isCrossAssociatedWith(table)) {
        table.prototype[assocName] = function(callback) {
          var Association = sequelize.tables[Sequelize.Helper.SQL.manyToManyTableName(_table, table)].klass
          var whereConditions = [table.identifier, this.id].join("=")
          Association.findAll({ where: whereConditions }, function(result) {
            if(result.length > 0) {
              var ids = []
              result.forEach(function(resultSet) { ids.push(resultSet.id) })
              _table.findAll({where: "id IN (" + ids.join(",") + ")"}, callback)
            } else {
              if(callback) callback([])
            }
          })
        }
        table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = function(objects, callback) {
          var self = this
          var Association = sequelize.tables[Sequelize.Helper.SQL.manyToManyTableName(_table, table)].klass
          var currentAssociations = null
          var objectIds = Sequelize.Helper.Array.map(objects, function(obj) { return obj.id })
          
          var getAssociatedObjects = function(callback) {
            self[assocName](function(associations) {
              currentAssociations = associations
              callback(associations) 
            })
          }
          var deleteObsoleteAssociations = function(callback) {
            var obsolete = []
            currentAssociations.forEach(function(association) {
              if(objectIds.indexOf(association.id) == -1) obsolete.push(association.id)
            })
            if(obsolete.length == 0)
              callback([])
            else
              sequelize.query(
                Sequelize.sqlQueryFor('delete', {table: Association.tableName, where: "id IN (" + obsolete.join(",") + ")", limit: null}),
                function(){ callback(obsolete) }
              )
          }
          var createNewAssociations = function(obsolete) {
            var currentIds = Sequelize.Helper.Array.map(currentAssociations, function(assoc) { return assoc.id })
            var withoutExisting = Sequelize.Helper.Array.reject(objects, function(o) {
              currentIds.indexOf(o.id) > -1
            })
            var savings = []
            withoutExisting.forEach(function(o) {
              if((o instanceof _table) && (self.id != null) && (o.id != null)) {
                var attributes = {}
                attributes[self.table.identifier] = self.id
                attributes[o.table.identifier] = o.id
                savings.push({save: new Association(attributes)})
              }
            })
            Sequelize.chainQueries(savings, function() {
              getAssociatedObjects(callback)
            })
          }
          
          getAssociatedObjects(function() {
            deleteObsoleteAssociations(function(obsolete) {
              createNewAssociations(obsolete)
            })
          })
        }
      } else {
        table.prototype[assocName] = function(callback) {
          var whereConditions = [table.identifier, this.id].join("=")
          _table.findAll({where: whereConditions}, callback)
        }
        table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = function(objects, callback) {
          var self = this
          var objectIds = Sequelize.Helper.Array.map(objects, function(obj) { return obj.id })
          this[assocName](function(currentAssociations) {
            var currentIds = Sequelize.Helper.Array.map(currentAssociations, function(assoc) { return assoc.id })
            var obsoleteAssociations = Sequelize.Helper.Array.select(currentAssociations, function(assoc) { return objectsIds.indexOf(assoc.id) == -1 })
            var queries = []
            obsoleteAssociations.forEach(function(assoc) {
              var attr = {}; attr[table.identifier] = null
              queries.push({updateAttributes: assoc, params: [attr]})
            })
            var newAssociations = Sequelize.Helper.Array.select(objects, function(o) { return currentIds.indexOf(o.id) == -1 })
            newAssociations.forEach(function(assoc) {
              var attr = {}; attr[table.identifier] = self.id
              queries.push({updateAttributes: assoc, params: [attr]})
            })
            Sequelize.chainQueries(queries, function() {
              self[assocName](callback)
            })
          })
        }
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
      
      table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = function(object, callback) {
        var self = this
        
        this[assocName](function(currentAssociation) {
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
      
      table.prototype[assocName] = function(callback) {
        if((this[_table.identifier] == null)||(isNaN(this[_table.identifier])))
          callback([])
        else
          _table.find(this[_table.identifier], callback)
      }
      
      table.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = function(object, callback) {
        var attr = {}; attr[object.table.identifier] = object.id
        var self = this
        this.updateAttributes(attr, function() {
          self[assocName](callback)
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
    
    save: function(callback) {
      var query = null
      var self = this

      this.updatedAt = new Date()
      if(this.id == null) {
        this.createdAt = new Date()
        query = Sequelize.sqlQueryFor('insert', {
          table: table.tableName,
          fields: Sequelize.Helper.SQL.fieldsForInsertQuery(this),
          values: Sequelize.Helper.SQL.valuesForInsertQuery(this)
        })
      } else
        query = Sequelize.sqlQueryFor('update', { table: table.tableName, values: Sequelize.Helper.SQL.valuesForUpdate(this), id: this.id })
      
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