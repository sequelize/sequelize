var Utils = require('./../utils')

module.exports = (function() {
  var HasManyDoubleLinked = function(definition, instance) {
    this.__factory = definition
    this.instance = instance
  }

  HasManyDoubleLinked.prototype.injectGetter = function(options) {
    var self = this, _options = options

    var customEventEmitter = new Utils.CustomEventEmitter(function() {
      var where = {}, options = _options || {};

      //fully qualify
      where[self.__factory.connectorDAO.tableName+"."+self.__factory.identifier] = self.instance.id

      var primaryKeys = Object.keys(self.__factory.connectorDAO.rawAttributes)
        , foreignKey  = primaryKeys.filter(function(pk) { return pk != self.__factory.identifier })[0]

      where[self.__factory.connectorDAO.tableName+"."+foreignKey] = {join: self.__factory.target.tableName+".id"}

      if (options.where) {
        Utils._.each(options.where, function(value, index) {
          delete options.where[index];
          options.where[self.__factory.target.tableName+"."+index] = value;
        });

        Utils._.extend(options.where, where)
      } else {
        options.where = where;
      }

      self.__factory.target.findAllJoin(self.__factory.connectorDAO.tableName, options)
        .on('success', function(objects) { customEventEmitter.emit('success', objects) })
        .on('error', function(err){ customEventEmitter.emit('error', err) })
        .on('sql', function(sql) { customEventEmitter.emit('sql', sql)})
    })

    return customEventEmitter.run()
  }

  HasManyDoubleLinked.prototype.injectSetter = function(emitterProxy, oldAssociations, newAssociations) {
    var self = this

    destroyObsoleteAssociations
      .call(this, oldAssociations, newAssociations)
      .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
      .error(function(err) { emitterProxy.emit('error', err) })
      .success(function() {
        var chainer             = new Utils.QueryChainer
          , association         = self.__factory.target.associations[self.__factory.associationAccessor]
          , foreignIdentifier   = association.isSelfAssociation ? association.foreignIdentifier : association.identifier
          , unassociatedObjects = newAssociations.filter(function (obj) { 
              return !Utils._.find(oldAssociations, function (old) {
                return obj.id === old.id
              }) 
            })

        unassociatedObjects.forEach(function(unassociatedObject) {
          var attributes = {}
          attributes[self.__factory.identifier] = self.instance.id
          attributes[foreignIdentifier] = unassociatedObject.id

          chainer.add(self.__factory.connectorDAO.create(attributes))
        })

        chainer
          .run()
          .success(function() { emitterProxy.emit('success', newAssociations) })
          .error(function(err) { emitterProxy.emit('error', err) })
          .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
      })
  }

  HasManyDoubleLinked.prototype.injectAdder = function(emitterProxy, newAssociation) {
    var attributes = {}
      , association         = this.__factory.target.associations[this.__factory.associationAccessor]
      , foreignIdentifier   = association.isSelfAssociation ? association.foreignIdentifier : association.identifier;

    attributes[this.__factory.identifier] = this.instance.id
    attributes[foreignIdentifier] = newAssociation.id

    this.__factory.connectorDAO.create(attributes)
      .success(function() { emitterProxy.emit('success', newAssociation) })
      .error(function(err) { emitterProxy.emit('error', err) })
      .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
  }

  // private

  var destroyObsoleteAssociations = function(oldAssociations, newAssociations) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer()
      var foreignIdentifier = self.__factory.target.associations[self.__factory.associationAccessor].identifier
      var obsoleteAssociations = oldAssociations.filter(function (old) {
        // Return only those old associations that are not found in new
        return !Utils._.find(newAssociations, function (obj) {
          return obj.id === old.id
        })
      })

      if (obsoleteAssociations.length === 0) {
        return emitter.emit('success', null)
      }

      obsoleteAssociations.forEach(function(associatedObject) {
        var where            = {}
          , primaryKeys      = Object.keys(self.__factory.connectorDAO.rawAttributes)
          , foreignKey       = primaryKeys.filter(function(pk) { return pk != self.__factory.identifier })[0]
          , notFoundEmitters = []

        where[self.__factory.identifier] = self.instance.id
        where[foreignKey] = associatedObject.id

        self.__factory.connectorDAO
          .find({ where: where })
          .success(function(connector) {
            if (connector === null) {
              notFoundEmitters.push(null)
            } else {
              chainer.add(connector.destroy())
            }

            if ((chainer.emitters.length + notFoundEmitters.length) === obsoleteAssociations.length) {
              // found all obsolete connectors and will delete them now
              chainer
                .run()
                .success(function() { emitter.emit('success', null) })
                .error(function(err) { emitter.emit('error', err) })
                .on('sql', function(sql) { emitter.emit('sql', sql) })
            }
          })
          .error(function(err) { emitter.emit('error', err) })
          .on('sql', function(sql) { emitter.emit('sql', sql) })
      })
    }).run()
  }

  return HasManyDoubleLinked
})()
