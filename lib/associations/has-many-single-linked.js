var Utils = require('./../utils')

module.exports = (function() {
  var HasManySingleLinked = function(definition, instance) {
    this.__factory = definition
    this.instance = instance
  }

  HasManySingleLinked.prototype.injectGetter = function(options) {
    var where = {}
    options = options || {}

    where[this.__factory.identifier] = this.instance.id

    options.where = options.where ? Utils._.extend(options.where, where) : where
    return this.__factory.target.findAll(options)
  }

  HasManySingleLinked.prototype.injectSetter = function(emitter, oldAssociations, newAssociations) {
    var self    = this
      , chainer = new Utils.QueryChainer()
      , obsoleteAssociations = oldAssociations.filter(function (old) { 
          return !Utils._.find(newAssociations, function (obj) {
            return obj.id === old.id
          }) 
        })
      , unassociatedObjects = newAssociations.filter(function (obj) { 
          return !Utils._.find(oldAssociations, function (old) {
            return obj.id === old.id
          }) 
        })
      , update

    if (obsoleteAssociations.length > 0) {
      // clear the old associations
      var obsoleteIds = obsoleteAssociations.map(function(associatedObject) { return associatedObject.id })

      update = {} 
      update[self.__factory.identifier] = null
      chainer.add(this.__factory.target.update(update, { id: obsoleteIds }))
    } 

    if (unassociatedObjects.length > 0) {
      // set the new associations
      var unassociatedIds = unassociatedObjects.map(function(associatedObject) { return associatedObject.id })

      update = {}
      update[self.__factory.identifier] = self.instance.id
      chainer.add(this.__factory.target.update(update, { id: unassociatedIds }))
    }

    chainer
      .run()
      .success(function() { emitter.emit('success', newAssociations) })
      .error(function(err) { emitter.emit('error', err) })
      .on('sql', function(sql) { emitter.emit('sql', sql) })
  }

  HasManySingleLinked.prototype.injectAdder = function(emitterProxy, newAssociation) {
    newAssociation[this.__factory.identifier] = this.instance.id

    newAssociation.save()
      .success(function() { emitterProxy.emit('success', newAssociation) })
      .error(function(err) { emitterProxy.emit('error', err) })
      .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
  }

  return HasManySingleLinked
})()
