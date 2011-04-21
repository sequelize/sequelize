var Utils        = require("./../utils")
  , DataTypes    = require('./../data-types')
  , QueryChainer = require("./../query-chainer")

var HasMany = module.exports = function(srcModel, targetModel, options) {
  this.source = srcModel
  this.target = targetModel
  this.options = options
  this.accessors = {
    get: Utils._.camelize('get_' + (this.options.as || this.target.tableName + 's')),
    set: Utils._.camelize('set_' + (this.options.as || this.target.tableName + 's'))
  }
}

// the id is in the target table
// or in an extra table which connects two tables
HasMany.prototype.injectAttributes = function() {
  this.identifier = this.options.foreignKey || Utils._.underscoredIf(this.source.tableName + "Id", this.options.underscored)
  
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
    var instance = this
    if(self.connectorModel) {
      var customEventEmitter = new Utils.CustomEventEmitter(function() {
        var where = {}
        where[self.identifier] = instance.id

        self.connectorModel.findAll({where: where}).on('success', function(associatedObjects) {
          customEventEmitter.emit('success', associatedObjects)
        })
      })
      return customEventEmitter.run()
    } else {
      var where = {}
    
      where[self.identifier] = this.id
      return self.target.findAll({where: where})
    }
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
        if(self.connectorModel) {
          var foreignIdentifier = self.target.associations[self.source.tableName].identifier
          var destroyChainer = new QueryChainer
          // destroy the old association objects
          oldAssociatedObjects.forEach(function(associatedObject) { destroyChainer.add(associatedObject.destroy()) })
          destroyChainer
          .run()
          .on('failure', function(err) { customEventEmitter.emit('failure', err) })
          .on('success', function() {
            // create new one
            
            var createChainer = new QueryChainer
            newAssociatedObjects.forEach(function(associatedObject) {
              var attributes = {}
              attributes[self.identifier] = instance.id
              attributes[foreignIdentifier] = associatedObject.id

              createChainer.add(self.connectorModel.create(attributes))
            })
            
            createChainer
            .run()
            .on('success', function() { customEventEmitter.emit('success', null) })
            .on('failure', function(err) { customEventEmitter.emit('failure', err) })
            
          })
        } else {
          // clear the old associations
          oldAssociatedObjects.forEach(function(associatedObject) {
            associatedObject[self.identifier] = null
            associatedObject.save()
          })
        
          // set the new one
          var chainer = new QueryChainer
          newAssociatedObjects.forEach(function(associatedObject) {
            associatedObject[self.identifier] = instance.id
            chainer.add(associatedObject.save())
          })
          chainer
          .run()
          .on('success', function() { customEventEmitter.emit('success', null) })
          .on('failure', function() { customEventEmitter.emit('failure', null) })
        }
      })
    })
    return customEventEmitter.run()
  }
  
  return this
}