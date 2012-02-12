var Utils = require('./../utils')

module.exports = (function() {
  var HasManyDoubleLinked = function(definition, instance) {
    this.__factory = definition
    this.instance = instance
  }

  HasManyDoubleLinked.prototype.injectGetter = function() {
    var self = this

    var customEventEmitter = new Utils.CustomEventEmitter(function() {
      var where = {}
      //fully qualify
      where[self.__factory.connectorDAO.tableName+"."+self.__factory.identifier] = self.instance.id

      var primaryKeys = Utils._.keys(self.__factory.connectorDAO.rawAttributes)
        , foreignKey  = primaryKeys.filter(function(pk) { return pk != self.__factory.identifier })[0]

      where[self.__factory.connectorDAO.tableName+"."+foreignKey] = {join: self.__factory.target.tableName+".id"}
      self.__factory.target.findAllJoin(self.__factory.connectorDAO.tableName, {where: where})
      .on('success', function(objects) { customEventEmitter.emit('success', objects) })
      .on('failure', function(err){ customEventEmitter.emit('failure', err) })
      .on('sql', function(sql) { customEventEmitter.emit('sql', sql)})
    })

    return customEventEmitter.run()
  }

  HasManyDoubleLinked.prototype.injectSetter = function(emitter, oldAssociations, newAssociations) {
    var self = this

    destroyObsoleteAssociations.call(this, oldAssociations, newAssociations)
      .error(function(err) { emitter.emit('failure', err) })
      .on('sql', function(sql) { emitter.emit('sql', sql) })
      .success(function() {
        var chainer             = new Utils.QueryChainer
          , association         = self.__factory.target.associations[self.__factory.associationAccessor]
          , foreignIdentifier   = association.isSelfAssociation ? association.foreignIdentifier : association.identifier
          , unassociatedObjects = newAssociations.filter(function(obj) { return !obj.equalsOneOf(oldAssociations) })

        unassociatedObjects.forEach(function(unassociatedObject) {
          var attributes = {}
          attributes[self.__factory.identifier] = self.instance.id
          attributes[foreignIdentifier] = unassociatedObject.id

          chainer.add(self.__factory.connectorDAO.create(attributes))
        })

        chainer
          .run()
          .success(function() { emitter.emit('success', newAssociations) })
          .error(function(err) { emitter.emit('failure', err) })
          .on('sql', function(sql) { emitter.emit('sql', sql) })
      })
  }

  // private

  var destroyObsoleteAssociations = function(oldAssociations, newAssociations) {
    var self = this

    var emitter = new Utils.CustomEventEmitter(function() {
      var chainer = new Utils.QueryChainer
      var foreignIdentifier = self.__factory.target.associations[self.__factory.associationAccessor].identifier
      var obsoleteAssociations = oldAssociations.filter(function(obj) { return !obj.equalsOneOf(newAssociations) })

      if(obsoleteAssociations.length == 0)
        return emitter.emit('success', null)

      obsoleteAssociations.forEach(function(associatedObject) {
        var where       = {}
          , primaryKeys = Utils._.keys(self.__factory.connectorDAO.rawAttributes)
          , foreignKey  = primaryKeys.filter(function(pk) { return pk != self.__factory.identifier })[0]

        where[self.__factory.identifier] = self.instance.id
        where[foreignKey] = associatedObject.id

        self.__factory.connectorDAO.find({where: where}).success(function(connector) {
          chainer.add(connector.destroy())

          if(chainer.emitters.length == obsoleteAssociations.length) {
            // found all obsolete connectors and will delete them now
            chainer
              .run()
              .success(function() { emitter.emit('success', null) })
              .error(function(err) { emitter.emit('failure', err) })
              .on('sql', function(sql) { emitter.emit('sql', sql) })
          }
        })
      })
    })
    return emitter.run()
  }

  return HasManyDoubleLinked
})()
