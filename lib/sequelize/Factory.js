module.exports.Factory = function(Sequelize, sequelize) {
  var Factory = {
    addManyToManyMethods: function(table1, table2, assocName, backAssocName) {
      table1.prototype[Sequelize.Helper.SQL.addPrefix('get', assocName)] = Factory.createManyToManyGetter(table1, table2, assocName, backAssocName)
      table1.prototype[Sequelize.Helper.SQL.addPrefix('set', assocName)] = Factory.createManyToManySetter(table1, table2, assocName, backAssocName)
    },
    
    addOneToManyMethods: function(table1, table2, assocName, methodName) {
      var setterName = Sequelize.Helper.SQL.addPrefix('set', methodName || assocName),
          getterName = Sequelize.Helper.SQL.addPrefix('get', methodName || assocName)
          
      table1.prototype[setterName] = Factory.createOneToManySetter(table1, assocName, methodName)
      table1.prototype[getterName] = Factory.createOneToManyGetter(table1, table2, assocName, methodName)
    },
    
    addOneToOneMethods: function(table1, table2, assocName, backAssocName) {
      var setterName = Sequelize.Helper.SQL.addPrefix('set', backAssocName || assocName, true),
          getterName = Sequelize.Helper.SQL.addPrefix('get', backAssocName || assocName, true)
          
      // getter
      table1.prototype[getterName] = function(callback) {
        var whereConditions = {}
        whereConditions[Sequelize.Helper.SQL.asTableIdentifier(assocName)] = this.id
        table2.find(whereConditions, callback)
      }
      
      // setter
      table1.prototype[setterName] = function(object, callback) {
        var self = this
        
        this[Sequelize.Helper.SQL.addPrefix('get', backAssocName, true)](function(currentAssociation) {
          var attr = {}
          
          if(currentAssociation == null) {
            attr[Sequelize.Helper.SQL.asTableIdentifier(assocName)] = self.id
            object.updateAttributes(attr, callback)
          } else {
            if(object.id == currentAssociation.id) callback(currentAssociation)
            else {
              // first update the currently associated item to have no association any more
              attr[Sequelize.Helper.SQL.asTableIdentifier(assocName)] = null
              currentAssociation.updateAttributes(attr, function() {
                // now update the object itself to set the new association
                attr[Sequelize.Helper.SQL.asTableIdentifier(assocName)] = self.id
                object.updateAttributes(attr, callback)
              })
            }
          }
        })
      }
    },
    
    createManyToManyGetter: function(table1, table2, assocName, backAssocName) {
      return function(options, callback) {
        var _callback   = ((typeof options == 'object') ? callback : options),
            _options    = (typeof options == 'object') ? options : {},
            self        = this

        if(_options.force || !this.hasFetchedAssociationFor(assocName)) {
          var Association = sequelize.tables[Sequelize.Helper.SQL.manyToManyTableName(assocName, backAssocName)].klass,
              assocNameAsTableIdentifier = Sequelize.Helper.SQL.asTableIdentifier(backAssocName),
              whereConditions = [assocNameAsTableIdentifier, this.id].join("=")

          Association.findAll({ where: whereConditions }, function(result) {
            if(result.length > 0) {
              var ids = Sequelize.Helper.Array.map(result, function(resultSet) {
                return resultSet[Sequelize.Helper.SQL.asTableIdentifier(assocName)]
              })

              table2.findAll({where: "id IN (" + ids.join(",") + ")"}, function(objects) {
                self.setAssociationDataFor(assocName, objects)
                if(_callback) _callback(objects)
              })
            } else {
              if(_callback) _callback([])
            }
          })
        } else {
          if(_callback) _callback(this.getAssociationDataFor(assocName))
        }
      }
    },
    createManyToManySetter: function(table1, table2, assocName, backAssocName) {
      return function(objects, callback) {
        var self = this,
            Association = sequelize.tables[Sequelize.Helper.SQL.manyToManyTableName(assocName, backAssocName)].klass,
            objectIds = Sequelize.Helper.Array.map(objects, function(obj) { return obj.id })
        
        var getAssociatedObjects = function(callback) {
          self[Sequelize.Helper.SQL.addPrefix('get', assocName)]({refetchAssociations: true}, callback)
        }
        
        var deleteObsoleteAssociations = function(currentAssociations, callback) {
          var obsoleteAssociations = Sequelize.Helper.Array.select(currentAssociations, function(assoc) { return objectIds.indexOf(assoc.id) == -1 }),
              obsoleteIds = Sequelize.Helper.Array.map(obsoleteAssociations, function(assoc) { return assoc.id })
              
          if(obsoleteIds.length == 0)
            callback([])
          else {
            var deleteOptions = {
              table: Association.tableName,
              where: Sequelize.Helper.SQL.asTableIdentifier(assocName) + " IN (" + obsoleteIds.join(",") + ") AND " + 
                Sequelize.Helper.SQL.asTableIdentifier(backAssocName) + " = " + self.id,
              limit: null
            }
            sequelize.query( Sequelize.sqlQueryFor('delete', deleteOptions), function(){ callback(obsoleteIds) } )
          }
          
        }
        
        var createNewAssociations = function(currentAssociations, obsoleteIds) {
          var currentIds = Sequelize.Helper.Array.map(currentAssociations, function(assoc) { return assoc.id }),
              withoutExisting = Sequelize.Helper.Array.select(objects, function(o) { return currentIds.indexOf(o.id) == -1 }),
              savings = []

          withoutExisting.forEach(function(o) {
            if((o instanceof table2) && (self.id != null) && (o.id != null)) {
              var attributes = {}
              attributes[Sequelize.Helper.SQL.asTableIdentifier(backAssocName)] = self.id
              attributes[Sequelize.Helper.SQL.asTableIdentifier(assocName)] = o.id
              savings.push({save: new Association(attributes)})
            }
          })
          
          Sequelize.chainQueries(savings, function() {
            getAssociatedObjects(callback)
          })
        }
        
        getAssociatedObjects(function(associatedObjects) {
          deleteObsoleteAssociations(associatedObjects, function(obsolete) {
            createNewAssociations(associatedObjects, obsolete)
          })
        })
      }
    },
    createOneToManyGetter: function(table1, table2, assocName, methodName) {
      return function(options, callback) {
        var _callback = ((typeof options == 'object') ? callback : options),
            _options  = (typeof options == 'object') ? options : {},
            accessKey = methodName || assocName,
            self      = this

        if(_options.refetchAssociations || !this.hasFetchedAssociationFor(accessKey)) {
          var whereConditions = [Sequelize.Helper.SQL.asTableIdentifier(assocName), this.id].join("=")
          table2.findAll({where: whereConditions}, function(result) {
            self.setAssociationDataFor(accessKey, result)
            if(_callback) _callback(result)
          })
        } else {
          var result = self.getAssociationDataFor(accessKey)
          if(_callback) _callback(result)
        }
      }
    },
    createOneToManySetter: function(table1, assocName, methodName) {
      return function(objects, callback) {
        var self       = this,
            objectIds  = Sequelize.Helper.Array.map(objects, function(obj) { return obj.id }),
            getterName = Sequelize.Helper.SQL.addPrefix('get', methodName)
            
        this[getterName]({refetchAssociations: true}, function(currentAssociations) {
          var currentIds = Sequelize.Helper.Array.map(currentAssociations, function(assoc) { return assoc.id }),
              obsoleteAssociations = Sequelize.Helper.Array.select(currentAssociations, function(assoc) { return objectIds.indexOf(assoc.id) == -1 }),
              queries = []
              
          obsoleteAssociations.forEach(function(assoc) {
            var attr = {}
            attr[Sequelize.Helper.SQL.asTableIdentifier(assocName)] = null
            queries.push({updateAttributes: assoc, params: [attr]})
          })
          
          var newAssociations = Sequelize.Helper.Array.select(objects, function(o) { return currentIds.indexOf(o.id) == -1 })
          newAssociations.forEach(function(assoc) {
            var attr = {}
            attr[Sequelize.Helper.SQL.asTableIdentifier(assocName)] = self.id
            queries.push({updateAttributes: assoc, params: [attr]})
          })
          
          Sequelize.chainQueries(queries, function() {
            self[getterName]({refetchAssociations: true}, callback)
          })
        })
      }
    }
  }
  
  return Factory
}