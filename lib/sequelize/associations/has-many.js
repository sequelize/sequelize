var Utils     = require("./../utils")
  , DataTypes = require('./../data-types')

var HasManySingleLinked = require("./has-many-single-linked")
  , HasManyMultiLinked  = require("./has-many-double-linked")

var HasMany = module.exports = function(srcModel, targetModel, options) {
  this.source = srcModel
  this.target = targetModel
  this.options = options
  
  var as = (this.options.as || Utils.pluralize(this.target.tableName))

  this.accessors = { 
    get: Utils._.camelize('get_' + as),
    set: Utils._.camelize('set_' + as),
    add: Utils._.camelize(Utils.singularize('add_' + as)),
    remove: Utils._.camelize(Utils.singularize('remove_' + as))
  }
}

// the id is in the target table
// or in an extra table which connects two tables
HasMany.prototype.injectAttributes = function() {
  this.identifier = this.options.foreignKey || Utils._.underscoredIf(Utils.singularize(this.source.tableName) + "Id", this.options.underscored)
  
  if (this.target.associations.hasOwnProperty(this.source.tableName)) {
    // remove the obsolete association identifier from the source
    this.foreignIdentifier = this.target.associations[this.source.tableName].identifier
    delete this.source.attributes[this.foreignIdentifier]
    
    // define a new model, which connects the models
    var combinedTableAttributes = {}
    combinedTableAttributes[this.identifier] = {type:DataTypes.INTEGER, primaryKey: true} 
    combinedTableAttributes[this.foreignIdentifier] = {type:DataTypes.INTEGER, primaryKey: true}
    
    this.connectorModel =
    this.target.associations[this.source.tableName].connectorModel =
    this.source.modelManager.sequelize.define(Utils.combineTableNames(this.source.tableName, this.target.tableName), combinedTableAttributes)
    
    this.connectorModel.sync()
  } else {
    var newAttributes = {}
    newAttributes[this.identifier] = { type: DataTypes.INTEGER }
    Utils._.extend(this.target.attributes, Utils.simplifyAttributes(newAttributes))
  }

  return this
}

HasMany.prototype.injectGetter = function(obj) {
  var self = this

  obj[this.accessors.get] = function() {
    var Class = self.connectorModel ? HasManyMultiLinked : HasManySingleLinked
    return new Class(self, this).injectGetter()
  }
  
  return this
}

HasMany.prototype.injectSetter = function(obj) {
  var self = this

  obj[this.accessors.set] = function(newAssociatedObjects) {
    var instance = this

    // define the returned customEventEmitter, which will emit the success event once everything is done
    var customEventEmitter = new Utils.CustomEventEmitter(function() {
      instance[self.accessors.get]().on('success', function(oldAssociatedObjects) {
        var Class = self.connectorModel ? HasManyMultiLinked : HasManySingleLinked
        new Class(self, instance).injectSetter(customEventEmitter, oldAssociatedObjects, newAssociatedObjects)
      })
    })
    return customEventEmitter.run()
  }
  
  obj[this.accessors.add] = function(newAssociatedObject) {
    var instance = this
    var customEventEmitter = new Utils.CustomEventEmitter(function() {
      instance[self.accessors.get]()
        .on('failure', function(err){ customEventEmitter.emit('failure', err)})
        .on('success', function(currentAssociatedObjects) {
          if(!newAssociatedObject.equalsOneOf(currentAssociatedObjects))
            currentAssociatedObjects.push(newAssociatedObject)
            
          instance[self.accessors.set](currentAssociatedObjects)
            .on('success', function() { customEventEmitter.emit('success', null) })
            .on('failure', function() { customEventEmitter.emit('failure', null) })
        })
    })
    return customEventEmitter.run()
  }
  
  obj[this.accessors.remove] = function(oldAssociatedObject) {
    var instance = this
    var customEventEmitter = new Utils.CustomEventEmitter(function() {
      instance[self.accessors.get]().on('success', function(currentAssociatedObjects) {
        var newAssociations = []

        currentAssociatedObjects.forEach(function(association) {
          if(!Utils._.isEqual(oldAssociatedObject.identifiers, association.identifiers))
            newAssociations.push(association)
        })

        instance[self.accessors.set](newAssociations)
          .on('success', function() { customEventEmitter.emit('success', null) })
          .on('failure', function(err) { customEventEmitter.emit('failure', err) })
      })
    })
    return customEventEmitter.run()
  }
  
  return this
}