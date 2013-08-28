var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')
  , Helpers   = require('./helpers')

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
    this.options.tableName = this.combinedName

    var as = (this.options.as || Utils.pluralize(this.target.tableName, this.target.options.language))

    this.accessors = {
      get: Utils._.camelize('get_' + as),
      set: Utils._.camelize('set_' + as),
      add: Utils._.camelize(Utils.singularize('add_' + as, this.target.options.language)),
      remove: Utils._.camelize(Utils.singularize('remove_' + as, this.target.options.language)),
      hasSingle: Utils._.camelize(Utils.singularize('has_' + as, this.target.options.language)),
      hasAll: Utils._.camelize('has_' + as)
    }
  }

  // the id is in the target table
  // or in an extra table which connects two tables
  HasMany.prototype.injectAttributes = function() {
    var multiAssociation = this.target.associations.hasOwnProperty(this.associationAccessor)
    this.identifier = this.options.foreignKey || Utils._.underscoredIf(Utils.singularize(this.source.tableName, this.source.options.language) + "Id", this.options.underscored)

    // is there already a single sided association between the source and the target?
    // or is the association on the model itself?
    if ((this.isSelfAssociation && this.useJunctionTable) || multiAssociation) {
      // remove the obsolete association identifier from the source
      if (this.isSelfAssociation) {
        this.foreignIdentifier = Utils._.underscoredIf((this.options.as || this.target.tableName) + 'Id', this.options.underscored)
      } else {
        this.foreignIdentifier = this.target.associations[this.associationAccessor].identifier
        this.target.associations[this.associationAccessor].foreignIdentifier = this.identifier
        delete this.source.rawAttributes[this.foreignIdentifier]
        delete this.target.associations[this.associationAccessor].source.rawAttributes[this.identifier]
      }

      // define a new model, which connects the models
      var combinedTableAttributes = {}
      var sourceKeys = Object.keys(this.source.primaryKeys);
      var sourceKeyType = ((!this.source.hasPrimaryKeys || sourceKeys.length !== 1) ? DataTypes.INTEGER : this.source.rawAttributes[sourceKeys[0]].type)
      var targetKeys = Object.keys(this.target.primaryKeys);
      var targetKeyType = ((!this.target.hasPrimaryKeys || targetKeys.length !== 1) ? DataTypes.INTEGER : this.target.rawAttributes[targetKeys[0]].type)
      combinedTableAttributes[this.identifier] = {type: sourceKeyType, primaryKey: true}
      combinedTableAttributes[this.foreignIdentifier] = {type: targetKeyType, primaryKey: true}

      this.connectorDAO = this.source.daoFactoryManager.sequelize.define(this.combinedName, combinedTableAttributes, this.options)

      if (!this.isSelfAssociation) {
        this.target.associations[this.associationAccessor].connectorDAO = this.connectorDAO
      }

      if (this.options.syncOnAssociation) {
        this.connectorDAO.sync()
      }
    } else {
      var newAttributes = {}
      newAttributes[this.identifier] = { type: this.options.keyType || DataTypes.INTEGER }
      Helpers.addForeignKeyConstraints(newAttributes[this.identifier], this.source, this.target, this.options)
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
      if (newAssociatedObjects === null) {
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
        , primaryKeys = Object.keys(newAssociatedObject.daoFactory.primaryKeys || {})
        , primaryKey = primaryKeys.length === 1 ? primaryKeys[0] : 'id'
        , where = {}

      where[newAssociatedObject.daoFactory.tableName+'.'+primaryKey] = newAssociatedObject[primaryKey]
      return new Utils.CustomEventEmitter(function(emitter) {
        instance[self.accessors.get]({ where: where })
          .error(function(err){ emitter.emit('error', err)})
          .success(function(currentAssociatedObjects) {
            if (currentAssociatedObjects.length === 0) {
              var Class = self.connectorDAO ? HasManyMultiLinked : HasManySingleLinked
              new Class(self, instance).injectAdder(emitter, newAssociatedObject)
            } else {
              emitter.emit('success', newAssociatedObject);
            }
          })
      }).run()
    }

    obj[this.accessors.remove] = function(oldAssociatedObject) {
      var instance = this
      var customEventEmitter = new Utils.CustomEventEmitter(function() {
        instance[self.accessors.get]().success(function(currentAssociatedObjects) {
          var newAssociations = []

          currentAssociatedObjects.forEach(function(association) {
            if (!Utils._.isEqual(oldAssociatedObject.identifiers, association.identifiers))
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
