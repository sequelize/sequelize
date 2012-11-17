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

    // clear the old associations
    oldAssociations.forEach(function(associatedObject) {
      associatedObject[self.__factory.identifier] = null
      chainer.add(associatedObject.save())
    })

    // set the new associations
    newAssociations.forEach(function(associatedObject) {
      associatedObject[self.__factory.identifier] = self.instance.id
      chainer.add(associatedObject.save())
    })

    chainer
      .run()
      .success(function() { emitter.emit('success', newAssociations) })
      .error(function(err) { emitter.emit('error', err) })
  }

  return HasManySingleLinked
})()
