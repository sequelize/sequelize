var Utils = require('./../utils')

var HasManySingleLinked = module.exports = function(definition, instance) {
  this.definition = definition
  this.instance = instance
}

HasManySingleLinked.prototype.injectGetter = function() {
  var where = {}

  where[this.definition.identifier] = this.instance.id
  return this.definition.target.findAll({where: where})
}
  
HasManySingleLinked.prototype.injectSetter = function(emitter, oldAssociations, newAssociations) {
  var self = this
  
  // clear the old associations
  oldAssociations.forEach(function(associatedObject) {
    associatedObject[self.definition.identifier] = null
    associatedObject.save()
  })

  // set the new one
  var chainer = new Utils.QueryChainer
  newAssociations.forEach(function(associatedObject) {
    associatedObject[self.definition.identifier] = self.instance.id
    chainer.add(associatedObject.save())
  })
  chainer
    .run()
    .on('success', function() { emitter.emit('success', newAssociations) })
    .on('failure', function(err) { emitter.emit('failure', err) })
}