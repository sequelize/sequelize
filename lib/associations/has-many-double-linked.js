var Utils       = require('./../utils')
  , Transaction = require('./../transaction')

module.exports = (function() {
  var HasManyDoubleLinked = function(definition, instance) {
    this.__factory = definition
    this.instance = instance

    // Alias the quoting methods for code brevity
    this.QueryInterface = instance.QueryInterface
  }

  HasManyDoubleLinked.prototype.injectGetter = function(options) {
    var self = this
      , _options = options
      , smart

    var customEventEmitter = new Utils.CustomEventEmitter(function() {
      var where = {}
        , connectorDAO = self.__factory.connectorDAO
        , options = _options || {}
        , queryOptions = {}
        , association = self.__factory.target.associations[self.__factory.associationAccessor]

      //fully qualify
      var instancePrimaryKeys = Object.keys(self.instance.daoFactory.primaryKeys)
        , instancePrimaryKey = instancePrimaryKeys.length > 0 ? instancePrimaryKeys[0] : 'id'

      where[connectorDAO.tableName+"."+self.__factory.identifier] = self.instance[instancePrimaryKey]

      var primaryKeys = Object.keys(connectorDAO.primaryKeys)
        , foreignKey  = primaryKeys.filter(function(pk) { return pk != self.__factory.identifier })[0]
        , foreignPrimary = Object.keys(self.__factory.target.primaryKeys)

      foreignPrimary = foreignPrimary.length === 1 ? foreignPrimary[0] : 'id'

      where[connectorDAO.tableName+"."+foreignKey] = {join: self.__factory.target.tableName+"."+foreignPrimary}

      if (association.hasJoinTableModel) {
        queryOptions.hasJoinTableModel = true
        queryOptions.joinTableModel = connectorDAO

        if (!options.attributes) {
          options.attributes = [
            self.QueryInterface.quoteIdentifier(self.__factory.target.tableName)+".*"
          ]
        }

        if (options.joinTableAttributes) {
          options.joinTableAttributes.forEach(function (elem) {
            options.attributes.push(
              self.QueryInterface.quoteIdentifiers(connectorDAO.tableName + '.' + elem) + ' as ' +
              self.QueryInterface.quoteIdentifier(connectorDAO.name + '.' + elem, true)
            )
          })
        } else {
          Utils._.forOwn(connectorDAO.rawAttributes, function (elem, key) {
            options.attributes.push(
              self.QueryInterface.quoteIdentifiers(connectorDAO.tableName + '.' + key) + ' as ' +
              self.QueryInterface.quoteIdentifier(connectorDAO.name + '.' + key, true)
            )
          })
        }
      }

      if (options.where) {
        if (Array.isArray(options.where)) {
          smart = Utils.smartWhere([where, options.where], self.__factory.target.daoFactoryManager.sequelize.options.dialect)
          smart = Utils.compileSmartWhere.call(self.__factory.target, smart, self.__factory.target.daoFactoryManager.sequelize.options.dialect)
          if (smart.length > 0) {
            options.where = smart
          }
        } else {
          smart = Utils.smartWhere([where, options.where], self.__factory.target.daoFactoryManager.sequelize.options.dialect)
          smart = Utils.compileSmartWhere.call(self.__factory.target, smart, self.__factory.target.daoFactoryManager.sequelize.options.dialect)
          if (smart.length > 0) {
            options.where = smart
          }
        }
      } else {
        options.where = where;
      }

      self.__factory.target.findAllJoin(connectorDAO.tableName, options, queryOptions)
        .on('success', function(objects) { customEventEmitter.emit('success', objects) })
        .on('error', function(err){ customEventEmitter.emit('error', err) })
        .on('sql', function(sql) { customEventEmitter.emit('sql', sql)})
    })

    return customEventEmitter.run()
  }

  HasManyDoubleLinked.prototype.injectSetter = function(emitterProxy, oldAssociations, newAssociations, defaultAttributes) {
    var self                 = this
      , chainer              = new Utils.QueryChainer()
      , association          = self.__factory.target.associations[self.__factory.associationAccessor]
      , foreignIdentifier    = association.isSelfAssociation ? association.foreignIdentifier : association.identifier
      , sourceKeys           = Object.keys(self.__factory.source.primaryKeys)
      , targetKeys           = Object.keys(self.__factory.target.primaryKeys)
      , obsoleteAssociations = []
      , changedAssociations  = []
      , options              = {}
      , unassociatedObjects;

    if ((defaultAttributes || {}).transaction instanceof Transaction) {
      options.transaction = defaultAttributes.transaction
      delete defaultAttributes.transaction
    }

    unassociatedObjects = newAssociations.filter(function (obj) {
      return !Utils._.find(oldAssociations, function (old) {
        return (!!obj[foreignIdentifier] && !!old[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : obj.id === old.id)
      })
    })

    oldAssociations.forEach(function (old) {
      var newObj = Utils._.find(newAssociations, function (obj) {
        return (!!obj[foreignIdentifier] && !!old[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : obj.id === old.id)
      })

      if (!newObj) {
        obsoleteAssociations.push(old)
      } else if (association.hasJoinTableModel) {
        var changedAssociation = {
          where: {},
          attributes: Utils._.defaults({}, newObj[self.__factory.connectorDAO.name], defaultAttributes)
        }

        changedAssociation.where[self.__factory.identifier] = self.instance[self.__factory.identifier] || self.instance.id
        changedAssociation.where[foreignIdentifier] = newObj[foreignIdentifier] || newObj.id

        changedAssociations.push(changedAssociation)
      }
    })

    if (obsoleteAssociations.length > 0) {
      var foreignIds = obsoleteAssociations.map(function (associatedObject) {
        return ((targetKeys.length === 1) ? associatedObject[targetKeys[0]] : associatedObject.id)
      })

      var where = {}

      where[self.__factory.identifier] = ((sourceKeys.length === 1) ? self.instance[sourceKeys[0]] : self.instance.id)
      where[foreignIdentifier] = foreignIds

      chainer.add(self.__factory.connectorDAO.destroy(where, options))
    }

    if (unassociatedObjects.length > 0) {
      var bulk = unassociatedObjects.map(function(unassociatedObject) {
        var attributes = {}

        attributes[self.__factory.identifier] = ((sourceKeys.length === 1) ? self.instance[sourceKeys[0]] : self.instance.id)
        attributes[foreignIdentifier] = ((targetKeys.length === 1) ? unassociatedObject[targetKeys[0]] : unassociatedObject.id)

        if (association.hasJoinTableModel) {
          attributes = Utils._.defaults(attributes, unassociatedObject[association.connectorDAO.name], defaultAttributes)
        }

        return attributes
      })

      chainer.add(self.__factory.connectorDAO.bulkCreate(bulk, options))
    }

    if (changedAssociations.length > 0) {
      changedAssociations.forEach(function (assoc) {
        chainer.add(self.__factory.connectorDAO.update(assoc.attributes, assoc.where, options))
      })
    }

    chainer
      .run()
      .success(function() { emitterProxy.emit('success', newAssociations) })
      .error(function(err) { emitterProxy.emit('error', err) })
      .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
  }

  HasManyDoubleLinked.prototype.injectAdder = function(emitterProxy, newAssociation, additionalAttributes, exists) {
    var attributes = {}
      , association         = this.__factory.target.associations[this.__factory.associationAccessor]
      , foreignIdentifier   = association.isSelfAssociation ? association.foreignIdentifier : association.identifier;

    var sourceKeys = Object.keys(this.__factory.source.primaryKeys);
    var targetKeys = Object.keys(this.__factory.target.primaryKeys);

    attributes[this.__factory.identifier] = ((sourceKeys.length === 1) ? this.instance[sourceKeys[0]] : this.instance.id)
    attributes[foreignIdentifier] = ((targetKeys.length === 1) ? newAssociation[targetKeys[0]] : newAssociation.id)

    if (exists) { // implies hasJoinTableModel === true
      var where = attributes
      attributes = Utils._.defaults({}, newAssociation[association.connectorDAO.name], additionalAttributes)

      association.connectorDAO.update(attributes, where).proxy(emitterProxy)
    } else {
      if (association.hasJoinTableModel === true) {
        attributes = Utils._.defaults(attributes, newAssociation[association.connectorDAO.name], additionalAttributes)
      }

      this.__factory.connectorDAO.create(attributes)
        .success(function() { emitterProxy.emit('success', newAssociation) })
        .error(function(err) { emitterProxy.emit('error', err) })
        .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
    }
  }

  return HasManyDoubleLinked
})()
