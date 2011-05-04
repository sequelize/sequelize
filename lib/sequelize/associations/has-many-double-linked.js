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
    
    var primaryKeys = Utils._.keys(self.definition.connectorModel.rawAttributes)
      , foreignKey  = primaryKeys.filter(function(pk) { return pk != self.definition.identifier })[0]
    
    self.definition.connectorModel.findAll({where: where}).on('success', function(associatedObjects) {
      var ids = associatedObjects.map(function(obj) { return obj[foreignKey] })

      if (ids.length == 0) {
        customEventEmitter.emit('success', [])
      } else {
        self.definition.target.findAll({where: 'id in (' + ids.join(", ") + ')'})
        .on('success', function(objects) { customEventEmitter.emit('success', objects) })
        .on('failure', function(err){ customEventEmitter.emit('failure', err) })
      }
    })
  })
  
  return customEventEmitter.run()
}

HasManyDoubleLinked.prototype.destroyObsoleteAssociations = function(oldAssociations, newAssociations) {
  var self = this
  
  var emitter = new Utils.CustomEventEmitter(function() {
    var chainer = new Utils.QueryChainer
    var foreignIdentifier = self.definition.target.associations[self.definition.source.tableName].identifier
    var obsoleteAssociations = oldAssociations.filter(function(obj) { return !obj.equalsOneOf(newAssociations) })

    if(obsoleteAssociations.length == 0)
      return emitter.emit('success', null)

    obsoleteAssociations.forEach(function(associatedObject) {
      var where       = {}
        , primaryKeys = Utils._.keys(self.definition.connectorModel.rawAttributes)
        , foreignKey  = primaryKeys.filter(function(pk) { return pk != self.definition.identifier })[0]

      where[self.definition.identifier] = self.instance.id
      where[foreignKey] = associatedObject.id

      self.definition.connectorModel.find({where: where}).on('success', function(connector) {
        chainer.add(connector.destroy())

        if(chainer.emitters.length == obsoleteAssociations.length) {
          // found all obsolete connectors and will delete them now
          chainer
            .run()
            .on('success', function() { emitter.emit('success', null) })
            .on('failure', function(err) { emitter.emit('failure', err) })
        }
      })
    })
  })
  return emitter.run()
}

HasManyDoubleLinked.prototype.injectSetter = function(emitter, oldAssociations, newAssociations) {
  var self = this
  
  this.destroyObsoleteAssociations(oldAssociations, newAssociations)
    .on('failure', function(err) { emitter.emit('failure', err) })
    .on('success', function() {
      var chainer = new Utils.QueryChainer
      var foreignIdentifier = self.definition.target.associations[self.definition.source.tableName].identifier
      var unassociatedObjects = newAssociations.filter(function(obj) { return !obj.equalsOneOf(oldAssociations) })
      
      unassociatedObjects.forEach(function(unassociatedObject) {
        var attributes = {}
        attributes[self.definition.identifier] = self.instance.id
        attributes[foreignIdentifier] = unassociatedObject.id
      
        chainer.add(self.definition.connectorModel.create(attributes))
      })
    
      chainer
        .run()
        .on('success', function() { emitter.emit('success', newAssociations) })
        .on('failure', function(err) { emitter.emit('failure', err) })
    })
}