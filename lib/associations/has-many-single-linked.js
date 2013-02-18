var Utils = require('./../utils')

module.exports = (function() {
  var HasManySingleLinked = function(definition, instance) {
    this.__factory = definition
    this.instance = instance
  }

  HasManySingleLinked.prototype.injectGetter = function(options) {
    var where = {}, options = options || {}

    where[this.__factory.identifier] = this.instance.id

    options.where = options.where ? Utils._.extend(options.where, where) : where
    return this.__factory.target.findAll(options)
  }

  HasManySingleLinked.prototype.injectSetter = function(emitter, oldAssociations, newAssociations) {
    var self    = this
      , options = this.__factory.options
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

    // clear the old associations
    obsoleteAssociations.forEach(function(associatedObject) {
      associatedObject[self.__factory.identifier] = null
      chainer.add(associatedObject.save())
    })

    // set the new associations
    unassociatedObjects.forEach(function(associatedObject) {
      associatedObject[self.__factory.identifier] = self.instance.id
      chainer.add(associatedObject.save())
    })

    chainer
      .run()
      .success(function() { emitter.emit('success', newAssociations) })
      .error(function(err) { emitter.emit('error', err) })
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
