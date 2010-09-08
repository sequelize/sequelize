module.exports.Factory = function(Sequelize, sequelize) {
  return {
    createManyToManyGetter: function(table1, table2, assocName, backAssocName) {
      return function(callback) {
        var Association = sequelize.tables[Sequelize.Helper.SQL.manyToManyTableName(assocName, backAssocName)].klass,
            assocNameAsTableIdentifier = Sequelize.Helper.SQL.asTableIdentifier(backAssocName),
            whereConditions = [assocNameAsTableIdentifier, this.id].join("=")
            
        Association.findAll({ where: whereConditions }, function(result) {
          if(result.length > 0) {
            var ids = Sequelize.Helper.Array.map(result, function(resultSet) {
              return resultSet[Sequelize.Helper.SQL.asTableIdentifier(backAssocName)]
            })
            Sequelize.Helper.log(ids)
            Sequelize.Helper.log(table2.tableName)
            table2.findAll({where: "id IN (" + ids.join(",") + ")"}, callback)
          } else {
            if(callback) callback([])
          }
        })
      }
    },
    createManyToManySetter: function(table1, table2, assocName, backAssocName) {
      return function(objects, callback) {
        var self = this,
            Association = sequelize.tables[Sequelize.Helper.SQL.manyToManyTableName(assocName, backAssocName)].klass,
            currentAssociations = null,
            objectIds = Sequelize.Helper.Array.map(objects, function(obj) { return obj.id })
            
        var getAssociatedObjects = function(callback) {
          self[Sequelize.Helper.SQL.addPrefix('get', assocName)](function(associations) {
            Sequelize.Helper.log("current assocs:")
            Sequelize.Helper.log(associations)
            currentAssociations = associations
            if(callback) callback(associations)
          })
        }
        
        var deleteObsoleteAssociations = function(callback) {
          var obsoleteAssociations = Sequelize.Helper.Array.select(currentAssociations, function(assoc) { return objectIds.indexOf(association.id) == -1 }),
              obsoleteIds = Sequelize.Helper.Array.map(obsoleteAssociations, function(assoc) { return assoc.id })
            
          Sequelize.Helper.log(obsoleteIds)
          
          if(obsoleteIds.length == 0)
            callback([])
          else
            sequelize.query(
              Sequelize.sqlQueryFor('delete', {table: Association.tableName, where: "id IN (" + obsoleteIds.join(",") + ")", limit: null}),
              function(){ callback(obsoleteIds) }
            )
        }
        var createNewAssociations = function(obsoleteIds) {
          var currentIds = Sequelize.Helper.Array.map(currentAssociations, function(assoc) { return assoc.id }),
              withoutExisting = Sequelize.Helper.Array.select(objects, function(o) { return currentIds.indexOf(o.id) == -1 }),
              savings = []
          
          Sequelize.Helper.log("current")
          Sequelize.Helper.log(obsoleteIds)
          Sequelize.Helper.log(currentIds)
          Sequelize.Helper.log(withoutExisting)
          
          Sequelize.Helper.log("withoutExisiting")
          withoutExisting.forEach(function(o) {
            Sequelize.Helper.log(o)
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
        
        getAssociatedObjects(function() {
          deleteObsoleteAssociations(function(obsolete) {
            createNewAssociations(obsolete)
          })
        })
      }
    },
    createOneToManyGetter: function(table1, table2, assocName) {
      return function(callback) {
        var whereConditions = [Sequelize.Helper.SQL.asTableIdentifier(assocName), this.id].join("=")
        table2.findAll({where: whereConditions}, callback)
      }
    },
    createOneToManySetter: function(table1) {
      return function(objects, callback) {
        var self = this,
            objectIds = Sequelize.Helper.Array.map(objects, function(obj) { return obj.id })
            
        this[assocName](function(currentAssociations) {
          var currentIds = Sequelize.Helper.Array.map(currentAssociations, function(assoc) { return assoc.id }),
              obsoleteAssociations = Sequelize.Helper.Array.select(currentAssociations, function(assoc) { return objectsIds.indexOf(assoc.id) == -1 }),
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
            self[assocName](callback)
          })
        })
      }
    }
  }
}