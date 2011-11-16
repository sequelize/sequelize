var Utils = require('./../utils')

module.exports = (function() {
  var HasManyDoubleLinked = function(definition, instance) {
    this.__definition = definition
    this.instance = instance
  }

  HasManyDoubleLinked.prototype.injectGetter = function() {
    var self = this

    var customEventEmitter = new Utils.CustomEventEmitter(function() {
      var where = {}
      where[self.__definition.identifier] = self.instance.id

      var primaryKeys = Utils._.keys(self.__definition.connectorModel.rawAttributes)
        , foreignKey  = primaryKeys.filter(function(pk) { return pk != self.__definition.identifier })[0]

      self.__definition.connectorModel.findAll({where: where}).success(function(associatedObjects) {
        var ids = associatedObjects.map(function(obj) { return obj[foreignKey] })

        if (ids.length == 0) {
          customEventEmitter.emit('success', [])
        } else {
          self.__definition.target.findAll({where: 'id in (' + ids.join(", ") + ')'})
          .success(function(objects) { customEventEmitter.emit('success', objects) })
          .on('failure', function(err){ customEventEmitter.emit('failure', err) })
        }
      })
    })

    return customEventEmitter.run()
  }

  HasManyDoubleLinked.prototype.injectSetter = function(emitter, oldAssociations, newAssociations) {
    var self = this

    destroyObsoleteAssociations.call(this, oldAssociations, newAssociations)
      .on('failure', function(err) { emitter.emit('failure', err) })
      .success(function() {
        var chainer             = new Utils.QueryChainer
          , association         = self.__definition.target.associations[self.__definition.associationAccessor]
          , foreignIdentifier   = association.isSelfAssociation ? association.foreignIdentifier : association.identifier
          , unassociatedObjects = newAssociations.filter(function(obj) { return !obj.equalsOneOf(oldAssociations) })

        unassociatedObjects.forEach(function(unassociatedObject) {
          var attributes = {}
          attributes[self.__definition.identifier] = self.instance.id
          attributes[foreignIdentifier] = unassociatedObject.id

          chainer.add(self.__definition.connectorModel.create(attributes))
        })

        chainer
          .run()
          .success(function() { emitter.emit('success', newAssociations) })
          .on('failure', function(err) { emitter.emit('failure', err) })
      })
  }

  // private

  var destroyObsoleteAssociations = function(oldAssociations, newAssociations) {
    var self = this

    var emitter = new Utils.CustomEventEmitter(function() {
      var chainer = new Utils.QueryChainer
      var foreignIdentifier = self.__definition.target.associations[self.__definition.associationAccessor].identifier
      var obsoleteAssociations = oldAssociations.filter(function(obj) { return !obj.equalsOneOf(newAssociations) })

      if(obsoleteAssociations.length == 0)
        return emitter.emit('success', null)

      obsoleteAssociations.forEach(function(associatedObject) {
        var where       = {}
          , primaryKeys = Utils._.keys(self.__definition.connectorModel.rawAttributes)
          , foreignKey  = primaryKeys.filter(function(pk) { return pk != self.__definition.identifier })[0]

        where[self.__definition.identifier] = self.instance.id
        where[foreignKey] = associatedObject.id

        self.__definition.connectorModel.find({where: where}).success(function(connector) {
          chainer.add(connector.destroy())

          if(chainer.emitters.length == obsoleteAssociations.length) {
            // found all obsolete connectors and will delete them now
            chainer
              .run()
              .success(function() { emitter.emit('success', null) })
              .on('failure', function(err) { emitter.emit('failure', err) })
          }
        })
      })
    })
    return emitter.run()
  }

  return HasManyDoubleLinked
})()
