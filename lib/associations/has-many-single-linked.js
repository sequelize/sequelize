var Utils = require('./../utils')

module.exports = (function() {
  var HasManySingleLinked = function(definition, instance) {
    this.__definition = definition
    this.instance = instance
  }

  HasManySingleLinked.prototype.injectGetter = function() {
    var where = {}

    where[this.__definition.identifier] = this.instance.id
    return this.__definition.target.findAll({where: where})
  }

  HasManySingleLinked.prototype.injectSetter = function(emitter, oldAssociations, newAssociations) {
    var self = this

    // clear the old associations
    oldAssociations.forEach(function(associatedObject) {
      associatedObject[self.__definition.identifier] = null
      associatedObject.save()
    })

    // set the new one
    var chainer = new Utils.QueryChainer
    newAssociations.forEach(function(associatedObject) {
      associatedObject[self.__definition.identifier] = self.instance.id
      chainer.add(associatedObject.save())
    })
    chainer
      .run()
      .success(function() { emitter.emit('success', newAssociations) })
      .error(function(err) { emitter.emit('failure', err) })
  }

  return HasManySingleLinked
})()
