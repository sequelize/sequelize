module.exports.Factory = function(Sequelize, sequelize) {
  return {
    createManyToManyGetter: function(table1, table2, assocName, backAssocName) {
      return function(callback) {
        var Association = sequelize.tables[Sequelize.Helper.SQL.manyToManyTableName(assocName, backAssocName)].klass
        var whereConditions = [table1.identifier, this.id].join("=")
        Association.findAll({ where: whereConditions }, function(result) {
          if(result.length > 0) {
            var ids = []
            result.forEach(function(resultSet) { ids.push(resultSet.id) })
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
            if((o instanceof table2) && (self.id != null) && (o.id != null)) {
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
    },
    createOneToManyGetter: function(table1, table2) {
      return function(callback) {
        var whereConditions = [table1.identifier, this.id].join("=")
        table2.findAll({where: whereConditions}, callback)
      }
    },
    createOneToManySetter: function(table1) {
      return function(objects, callback) {
        var self = this,
            objectIds = Sequelize.Helper.Array.map(objects, function(obj) { return obj.id })
            
        this[assocName](function(currentAssociations) {
          var currentIds = Sequelize.Helper.Array.map(currentAssociations, function(assoc) { return assoc.id })
          var obsoleteAssociations = Sequelize.Helper.Array.select(currentAssociations, function(assoc) { return objectsIds.indexOf(assoc.id) == -1 })
          var queries = []
          obsoleteAssociations.forEach(function(assoc) {
            var attr = {}; attr[table1.identifier] = null
            queries.push({updateAttributes: assoc, params: [attr]})
          })
          var newAssociations = Sequelize.Helper.Array.select(objects, function(o) { return currentIds.indexOf(o.id) == -1 })
          newAssociations.forEach(function(assoc) {
            var attr = {}; attr[table1.identifier] = self.id
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