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
        if (Array.isArray(options.where)) {
          smart = Utils.smartWhere([where, options.where], self.__factory.target.daoFactoryManager.sequelize.options.dialect)
          smart = Utils.compileSmartWhere.call(self.__factory.target, smart, self.__factory.target.daoFactoryManager.sequelize.options.dialect)
          if (smart.length > 0) {
            options.where = smart
          }
        } else {
          Utils._.each(options.where, function(value, index) {
            delete options.where[index];
            smart = Utils.smartWhere(value, self.__factory.target.daoFactoryManager.sequelize.options.dialect)
            smart = Utils.compileSmartWhere.call(self.__factory.target, smart)
            if (smart.length > 0) {
              value = smart
            }

            options.where[self.__factory.target.tableName+"."+index] = value;
          });

          options.where = Utils._.extend(options.where, where)
        }
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
      , chainer             = new Utils.QueryChainer()
      , association         = self.__factory.target.associations[self.__factory.associationAccessor]
      , foreignIdentifier   = association.isSelfAssociation ? association.foreignIdentifier : association.identifier
      , obsoleteAssociations = oldAssociations.filter(function (old) {
          // Return only those old associations that are not found in new
          return !Utils._.find(newAssociations, function (obj) {
            return obj.id === old.id
          })
        })
     , unassociatedObjects = newAssociations.filter(function (obj) {
          return !Utils._.find(oldAssociations, function (old) {
            return obj.id === old.id
          })
        })

    if (obsoleteAssociations.length > 0) {
      var foreignIds = obsoleteAssociations.map(function (associatedObject) {
            return associatedObject.id
          })
        , primaryKeys      = Object.keys(self.__factory.connectorDAO.rawAttributes)
        , foreignKey       = primaryKeys.filter(function(pk) { return pk != self.__factory.identifier })[0]

      var where = {}
      where[self.__factory.identifier] = self.instance.id
      where[foreignKey] = foreignIds

      chainer.add(self.__factory.connectorDAO.destroy(where))
    }

    if (unassociatedObjects.length > 0) {
      var bulk = unassociatedObjects.map(function(unassociatedObject) {
        var attributes = {}
        attributes[self.__factory.identifier] = self.instance.id
        attributes[foreignIdentifier] = unassociatedObject.id

        return attributes
      })

      chainer.add(self.__factory.connectorDAO.bulkCreate(bulk))
    }

    chainer
      .run()
      .success(function() { emitterProxy.emit('success', newAssociations) })
      .error(function(err) { emitterProxy.emit('error', err) })
      .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
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

  return HasManyDoubleLinked
})()
