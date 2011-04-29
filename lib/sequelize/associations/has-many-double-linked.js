var Utils = require('./../utils')

var HasManyDoubleLinked = module.exports = function(definition, instance) {
  this.definition = definition
  this.instance = instance
}

HasManyDoubleLinked.prototype.injectGetter = function() {
  var self = this
  
  var customEventEmitter = new Utils.CustomEventEmitter(function() {
    var where = {}
    where[self.definition.identifier] = self.instance.id

    self.definition.connectorModel.findAll({where: where}).on('success', function(associatedObjects) {
      customEventEmitter.emit('success', associatedObjects)
    })
  })
  
  return customEventEmitter.run()
}

HasManyDoubleLinked.prototype.injectSetter = function(emitter, oldAssociations, newAssociations) {
  var self = this
  
  // destroy the old association objects
  var foreignIdentifier = self.definition.target.associations[self.definition.source.tableName].identifier
  var destroyChainer = new Utils.QueryChainer
  oldAssociations.forEach(function(associatedObject) { destroyChainer.add(associatedObject.destroy()) })
  
  destroyChainer
  .run()
  .on('failure', function(err) { emitter.emit('failure', err) })
  .on('success', function() {
    // create new one
    
    var createChainer = new Utils.QueryChainer
    newAssociations.forEach(function(associatedObject) {
      var attributes = {}
      attributes[self.definition.identifier] = self.instance.id
      attributes[foreignIdentifier] = associatedObject.id

      createChainer.add(self.definition.connectorModel.create(attributes))
    })
    
    createChainer
    .run()
    .on('success', function() { emitter.emit('success', null) })
    .on('failure', function(err) { emitter.emit('failure', err) })
  })
}