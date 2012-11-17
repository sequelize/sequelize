var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

var HasManySingleLinked = require("./has-many-single-linked")
  , HasManyMultiLinked  = require("./has-many-double-linked")

module.exports = (function() {
  var HasMany = function(srcDAO, targetDAO, options) {
    this.associationType = 'HasMany'
    this.source = srcDAO
    this.target = targetDAO
    this.options = options
    this.useJunctionTable = this.options.useJunctionTable === undefined ? true : this.options.useJunctionTable
    this.isSelfAssociation = (this.source.tableName === this.target.tableName)

    var combinedTableName = Utils.combineTableNames(
      this.source.tableName,
      this.isSelfAssociation ? (this.options.as || this.target.tableName) : this.target.tableName
    )
    this.associationAccessor = this.combinedName = (this.options.joinTableName || combinedTableName)

    var as = (this.options.as || Utils.pluralize(this.target.tableName))

    this.accessors = {
      get: Utils._.camelize('get_' + as),
      set: Utils._.camelize('set_' + as),
      add: Utils._.camelize(Utils.singularize('add_' + as)),
      remove: Utils._.camelize(Utils.singularize('remove_' + as)),
      hasSingle: Utils._.camelize(Utils.singularize('has_' + as)),
      hasAll: Utils._.camelize('has_' + as)
    }
  }

  // the id is in the target table
  // or in an extra table which connects two tables
  HasMany.prototype.injectAttributes = function() {
    var multiAssociation = this.target.associations.hasOwnProperty(this.associationAccessor)
    this.identifier = this.options.foreignKey || Utils._.underscoredIf(Utils.singularize(this.source.tableName) + "Id", this.options.underscored)

    // is there already a single sided association between the source and the target?
    // or is the association on the model itself?
    if ((this.isSelfAssociation && this.useJunctionTable) || multiAssociation) {
      // remove the obsolete association identifier from the source
      if(this.isSelfAssociation) {
        this.foreignIdentifier = Utils._.underscoredIf((this.options.as || this.target.tableName) + 'Id', this.options.underscored)
      } else {
        this.foreignIdentifier = this.target.associations[this.associationAccessor].identifier
        delete this.source.rawAttributes[this.foreignIdentifier]
      }

      // define a new model, which connects the models
      var combinedTableAttributes = {}
      combinedTableAttributes[this.identifier] = {type:DataTypes.INTEGER, primaryKey: true}
      combinedTableAttributes[this.foreignIdentifier] = {type:DataTypes.INTEGER, primaryKey: true}

      this.connectorDAO = this.source.daoFactoryManager.sequelize.define(this.combinedName, combinedTableAttributes, this.options)

      if(!this.isSelfAssociation) {
        this.target.associations[this.associationAccessor].connectorDAO = this.connectorDAO
      }

      if(this.options.syncOnAssociation) {
        this.connectorDAO.sync()
      }
    } else {
      var newAttributes = {}
      newAttributes[this.identifier] = { type: DataTypes.INTEGER }
      Utils._.defaults(this.target.rawAttributes, newAttributes)
    }

    // Sync attributes to DAO proto each time a new assoc is added
    this.target.DAO.prototype.attributes = Object.keys(this.target.DAO.prototype.rawAttributes);
    this.source.DAO.prototype.attributes = Object.keys(this.source.DAO.prototype.rawAttributes);

    return this
  }

  HasMany.prototype.injectGetter = function(obj) {
    var self = this

    obj[this.accessors.get] = function(options) {
      var Class = self.connectorDAO ? HasManyMultiLinked : HasManySingleLinked
      return new Class(self, this).injectGetter(options)
    }

   obj[this.accessors.hasAll] = function(objects) {
    var instance = this;
      var customEventEmitter = new Utils.CustomEventEmitter(function() {
        instance[self.accessors.get]()
        .error(function(err){ customEventEmitter.emit('error', err)})
        .success(function(associatedObjects) {
          customEventEmitter.emit('success',
            Utils._.all(objects, function(o) {
              return Utils._.any(associatedObjects, function(associatedObject) {
                return Utils._.all(associatedObject.identifiers, function(key, identifier) {
                  return o[identifier] == associatedObject[identifier];
                });
              })
            })
          )
        })
      })
      return customEventEmitter.run()
    }

    obj[this.accessors.hasSingle] = function(o) {
    var instance = this;
      var customEventEmitter = new Utils.CustomEventEmitter(function() {
        instance[self.accessors.get]()
        .error(function(err){ customEventEmitter.emit('error', err)})
        .success(function(associatedObjects) {
          customEventEmitter.emit('success',
            Utils._.any(associatedObjects, function(associatedObject) {
              return Utils._.all(associatedObject.identifiers, function(key, identifier) {
                return o[identifier] == associatedObject[identifier];
              });
            })
          )
        })
      })
      return customEventEmitter.run()
    }
    return this
  }

  HasMany.prototype.injectSetter = function(obj) {
    var self = this

    obj[this.accessors.set] = function(newAssociatedObjects) {
      if(newAssociatedObjects === null) {
        newAssociatedObjects = []
      }

      var instance = this

      // define the returned customEventEmitter, which will emit the success event once everything is done
      return new Utils.CustomEventEmitter(function(emitter) {
        instance[self.accessors.get]()
          .success(function(oldAssociatedObjects) {
            var Class = self.connectorDAO ? HasManyMultiLinked : HasManySingleLinked
            new Class(self, instance).injectSetter(emitter, oldAssociatedObjects, newAssociatedObjects)
          })
          .error(function(err) {
            emitter.emit('error', err)
          })
          .on('sql', function(sql) {
            emitter.emit('sql', sql)
          })
      }).run()
    }

    obj[this.accessors.add] = function(newAssociatedObject) {
      var instance = this
      var customEventEmitter = new Utils.CustomEventEmitter(function() {
        instance[self.accessors.get]()
          .error(function(err){ customEventEmitter.emit('error', err)})
          .success(function(currentAssociatedObjects) {
            if(!newAssociatedObject.equalsOneOf(currentAssociatedObjects))
              currentAssociatedObjects.push(newAssociatedObject)

            instance[self.accessors.set](currentAssociatedObjects)
              .success(function(instances) { customEventEmitter.emit('success', instances) })
              .error(function(err) { customEventEmitter.emit('error', err) })
          })
      })
      return customEventEmitter.run()
    }

    obj[this.accessors.remove] = function(oldAssociatedObject) {
      var instance = this
      var customEventEmitter = new Utils.CustomEventEmitter(function() {
        instance[self.accessors.get]().success(function(currentAssociatedObjects) {
          var newAssociations = []

          currentAssociatedObjects.forEach(function(association) {
            if(!Utils._.isEqual(oldAssociatedObject.identifiers, association.identifiers))
              newAssociations.push(association)
          })

          instance[self.accessors.set](newAssociations)
            .success(function() { customEventEmitter.emit('success', null) })
            .error(function(err) { customEventEmitter.emit('error', err) })
        })
      })
      return customEventEmitter.run()
    }

    return this
  }

  return HasMany
})()
