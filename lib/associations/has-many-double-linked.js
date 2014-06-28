var Utils       = require('./../utils')
  , Transaction = require('./../transaction')

module.exports = (function() {
  var HasManyDoubleLinked = function(association, instance) {
    this.association = association
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
        , through = self.association.through
        , options = _options || {}
        , queryOptions = {}
        , targetAssociation = self.association.targetAssociation

      //fully qualify
      var instancePrimaryKeys = Object.keys(self.instance.daoFactory.primaryKeys)
        , instancePrimaryKey = instancePrimaryKeys.length > 0 ? instancePrimaryKeys[0] : 'id'
        , foreignPrimary = Object.keys(self.association.target.primaryKeys)

      foreignPrimary = foreignPrimary.length === 1 ? foreignPrimary[0] : 'id'

      where[through.tableName+"."+self.association.identifier] = self.instance[instancePrimaryKey]
      where[through.tableName+"."+self.association.foreignIdentifier] = {join: self.association.target.tableName+"."+foreignPrimary}

      if (Object(targetAssociation.through) === targetAssociation.through) {
        queryOptions.hasJoinTableModel = true
        queryOptions.joinTableModel = through

        if (!options.attributes) {
          options.attributes = [
            self.QueryInterface.quoteIdentifier(self.association.target.tableName)+".*"
          ]
        }

        if (options.joinTableAttributes) {
          options.joinTableAttributes.forEach(function (elem) {
            options.attributes.push(
              self.QueryInterface.quoteIdentifiers(through.tableName + '.' + elem) + ' as ' +
              self.QueryInterface.quoteIdentifier(through.name + '.' + elem, true)
            )
          })
        } else {
          Utils._.forOwn(through.rawAttributes, function (elem, key) {
            options.attributes.push(
              self.QueryInterface.quoteIdentifiers(through.tableName + '.' + key) + ' as ' +
              self.QueryInterface.quoteIdentifier(through.name + '.' + key, true)
            )
          })
        }
      }

      if (options.where) {
        if (Array.isArray(options.where)) {
          smart = Utils.smartWhere([where, options.where], self.association.target.daoFactoryManager.sequelize.options.dialect)
          smart = Utils.compileSmartWhere.call(self.association.target, smart, self.association.target.daoFactoryManager.sequelize.options.dialect)
          if (smart.length > 0) {
            options.where = smart
          }
        } else {
          smart = Utils.smartWhere([where, options.where], self.association.target.daoFactoryManager.sequelize.options.dialect)
          smart = Utils.compileSmartWhere.call(self.association.target, smart, self.association.target.daoFactoryManager.sequelize.options.dialect)
          if (smart.length > 0) {
            options.where = smart
          }
        }
      } else {
        options.where = where;
      }

      self.association.target.findAllJoin(through.tableName, options, queryOptions)
        .on('success', function(objects) { customEventEmitter.emit('success', objects) })
        .on('error', function(err){ customEventEmitter.emit('error', err) })
        .on('sql', function(sql) { customEventEmitter.emit('sql', sql)})
    })

    return customEventEmitter.run()
  }

  HasManyDoubleLinked.prototype.injectSetter = function(emitterProxy, oldAssociations, newAssociations, defaultAttributes) {
    var self                 = this
      , chainer              = new Utils.QueryChainer()
      , targetAssociation    = self.association.targetAssociation
      , foreignIdentifier    = targetAssociation.isSelfAssociation ? targetAssociation.foreignIdentifier : targetAssociation.identifier
      , sourceKeys           = Object.keys(self.association.source.primaryKeys)
      , targetKeys           = Object.keys(self.association.target.primaryKeys)
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
        return (!!obj[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : (!!obj[targetKeys[0]] ? obj[targetKeys[0]] === old[targetKeys[0]] : obj.id === old.id));
      })
    })

    oldAssociations.forEach(function (old) {
      var newObj = Utils._.find(newAssociations, function (obj) {
        return (!!obj[foreignIdentifier] ? obj[foreignIdentifier] === old[foreignIdentifier] : (!!obj[targetKeys[0]] ? obj[targetKeys[0]] === old[targetKeys[0]] : obj.id === old.id));
      })

      if (!newObj) {
        obsoleteAssociations.push(old)
      } else if (Object(targetAssociation.through) === targetAssociation.through) {
        var throughAttributes = newObj[self.association.through.name];
        // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
        if (throughAttributes instanceof self.association.through.DAO) {
          throughAttributes = {};
        }

        var changedAssociation = {
          where: {},
          attributes: Utils._.defaults({}, throughAttributes, defaultAttributes)
        }

        changedAssociation.where[self.association.identifier] = self.instance[self.association.identifier] || self.instance[self.association.source.primaryKeyAttributes[0]] || self.instance.id
        changedAssociation.where[foreignIdentifier] = newObj[foreignIdentifier] || newObj[self.association.target.primaryKeyAttributes[0]] || newObj.id

        if (Object.keys(changedAssociation.attributes).length) {
          changedAssociations.push(changedAssociation)
        }
      }
    })

    if (obsoleteAssociations.length > 0) {
      var foreignIds = obsoleteAssociations.map(function (associatedObject) {
        return ((targetKeys.length === 1) ? associatedObject[targetKeys[0]] : associatedObject.id)
      })

      var where = {}

      where[self.association.identifier] = ((sourceKeys.length === 1) ? self.instance[sourceKeys[0]] : self.instance.id)
      where[foreignIdentifier] = foreignIds

      chainer.add(self.association.through.destroy(where, options))
    }

    if (unassociatedObjects.length > 0) {
      var bulk = unassociatedObjects.map(function(unassociatedObject) {
        var attributes = {}

        attributes[self.association.identifier] = ((sourceKeys.length === 1) ? self.instance[sourceKeys[0]] : self.instance.id)
        attributes[foreignIdentifier] = ((targetKeys.length === 1) ? unassociatedObject[targetKeys[0]] : unassociatedObject.id)

        if (Object(targetAssociation.through) === targetAssociation.through) {
          attributes = Utils._.defaults(attributes, unassociatedObject[targetAssociation.through.name], defaultAttributes)
        }

        return attributes
      })

      chainer.add(self.association.through.bulkCreate(bulk, options))
    }

    if (changedAssociations.length > 0) {
      changedAssociations.forEach(function (assoc) {
        chainer.add(self.association.through.update(assoc.attributes, assoc.where, options))
      })
    }

    chainer
      .run()
      .success(function() { emitterProxy.emit('success', newAssociations) })
      .error(function(err) { emitterProxy.emit('error', err) })
      .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
  }

  HasManyDoubleLinked.prototype.injectAdder = function(emitterProxy, newAssociation, additionalAttributes, exists) {
    var attributes          = {}
      , targetAssociation   = this.association.targetAssociation
      , foreignIdentifier   = targetAssociation.isSelfAssociation ? targetAssociation.foreignIdentifier : targetAssociation.identifier
      , options = {}

    var sourceKeys = Object.keys(this.association.source.primaryKeys);
    var targetKeys = Object.keys(this.association.target.primaryKeys);

    if ((additionalAttributes || {}).transaction instanceof Transaction) {
      options.transaction = additionalAttributes.transaction
      delete additionalAttributes.transaction
    }

    attributes[this.association.identifier] = ((sourceKeys.length === 1) ? this.instance[sourceKeys[0]] : this.instance.id)
    attributes[foreignIdentifier] = ((targetKeys.length === 1) ? newAssociation[targetKeys[0]] : newAssociation.id)

    if (exists) {
      var where = attributes
      attributes = Utils._.defaults({}, newAssociation[targetAssociation.through.name], additionalAttributes)

      if (Object.keys(attributes).length) {
        targetAssociation.through.update(attributes, where).proxy(emitterProxy)
      } else {
        emitterProxy.emit('success')
      }
    } else {
      attributes = Utils._.defaults(attributes, newAssociation[targetAssociation.through.name], additionalAttributes)

      this.association.through.create(attributes, options)
        .success(function() { emitterProxy.emit('success', newAssociation) })
        .error(function(err) { emitterProxy.emit('error', err) })
        .on('sql', function(sql) { emitterProxy.emit('sql', sql) })
    }
  }

  return HasManyDoubleLinked
})()
