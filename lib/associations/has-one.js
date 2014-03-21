var Utils       = require("./../utils")
  , DataTypes   = require('./../data-types')
  , Helpers     = require("./helpers")
  , Transaction = require("../transaction")

module.exports = (function() {
  var HasOne = function(srcDAO, targetDAO, options) {
    this.associationType      = 'HasOne'
    this.source               = srcDAO
    this.target               = targetDAO
    this.options              = options
    this.isSingleAssociation  = true
    this.isSelfAssociation    = (this.source.tableName == this.target.tableName)
    this.as = this.options.as

    if (this.isSelfAssociation && !this.options.foreignKey && !!this.as) {
      this.options.foreignKey = Utils._.underscoredIf(Utils.singularize(this.as, this.target.options.language) + "Id", this.options.underscored)
    }

    if (this.as) {
      this.isAliased = true
    } else {
      this.as = Utils.singularize(this.target.tableName, this.target.options.language)
    }

    this.associationAccessor = this.isSelfAssociation
      ? Utils.combineTableNames(this.target.tableName, this.as)
      : this.as

    this.options.useHooks = options.useHooks

    this.accessors = {
      get: Utils._.camelize('get_' + this.as),
      set: Utils._.camelize('set_' + this.as),
      create: Utils._.camelize('create_' + this.as)
    }
  }

  // the id is in the target table
  HasOne.prototype.injectAttributes = function() {
    var newAttributes = {}
      , sourceKeys    = Object.keys(this.source.primaryKeys)
      , keyType       = ((this.source.hasPrimaryKeys && sourceKeys.length === 1) ? this.source.rawAttributes[sourceKeys[0]].type : DataTypes.INTEGER)

    this.identifier = this.options.foreignKey || Utils._.underscoredIf(Utils.singularize(this.source.tableName, this.source.options.language) + "Id", this.options.underscored)
    newAttributes[this.identifier] = { type: this.options.keyType || keyType }
    Utils._.defaults(this.target.rawAttributes, newAttributes)
    Helpers.addForeignKeyConstraints(this.target.rawAttributes[this.identifier], this.source, this.target, this.options)

    // Sync attributes and setters/getters to DAO prototype
    this.target.refreshAttributes()
    return this
  }

  HasOne.prototype.injectGetter = function(obj) {
    var self = this
      , smart

    obj[this.accessors.get] = function(params) {
      var primaryKeys = Object.keys(this.daoFactory.primaryKeys)
        , primaryKey = primaryKeys.length === 1 ? primaryKeys[0] : 'id'
        , where = {}
        , id = this[primaryKey] || this.id

      where[self.identifier] = id

      if (!Utils._.isUndefined(params)) {
        if (!Utils._.isUndefined(params.attributes)) {
          params = Utils._.extend({where: where}, params)
        }
      } else {
        params = {where: where}
      }

      smart = Utils.smartWhere(params.where || [], self.target.daoFactoryManager.sequelize.options.dialect)
      smart = Utils.compileSmartWhere.call(self.target, smart, self.target.daoFactoryManager.sequelize.options.dialect)
      if (smart.length > 0) {
        params.where = smart
      }

      var options = {}
      if (params.transaction) {
        options.transaction = params.transaction;
        delete params.transaction;
      }
      return self.target.find(params, options)
    }

    return this
  }

  HasOne.prototype.injectSetter = function(obj) {
    var self = this

    obj[this.accessors.set] = function(associatedObject, options) {
      var instance     = this
        , instanceKeys = Object.keys(instance.daoFactory.primaryKeys)
        , instanceKey  = instanceKeys.length === 1 ? instanceKeys[0] : 'id'

      return new Utils.CustomEventEmitter(function(emitter) {
        instance[self.accessors.get]().success(function(oldObj) {
          if (oldObj) {
            oldObj[self.identifier] = null
            oldObj
              .save(
                Utils._.extend({}, options, {
                  fields:    [self.identifier],
                  allowNull: [self.identifier],
                  association: true
                })
              )
              .success(function() {
                if (associatedObject) {
                  associatedObject[self.identifier] = instance[instanceKey]
                  associatedObject
                    .save(options)
                    .success(function() { emitter.emit('success', associatedObject) })
                    .error(function(err) { emitter.emit('error', err) })
                } else {
                  emitter.emit('success', null)
                }
              })
          } else {
            if (associatedObject) {
              associatedObject[self.identifier] = instance[instanceKey]
              associatedObject
                .save(options)
                .success(function() { emitter.emit('success', associatedObject) })
                .error(function(err) { emitter.emit('error', err) })
            } else {
              emitter.emit('success', null)
            }
          }
        })
      }).run()
    }

    return this
  }

  HasOne.prototype.injectCreator = function(obj) {
    var self = this

    obj[this.accessors.create] = function(values, fieldsOrOptions) {
      var instance = this
        , options = {}

      if ((fieldsOrOptions || {}).transaction instanceof Transaction) {
        options.transaction = fieldsOrOptions.transaction
      }

      return new Utils.CustomEventEmitter(function(emitter) {
        self.target
          .create(values, fieldsOrOptions)
          .proxy(emitter, { events: ['error', 'sql'] })
          .success(function(newAssociatedObject) {
            instance[self.accessors.set](newAssociatedObject, options)
              .proxy(emitter)
          })
      }).run()
    }

    return this
  };

  return HasOne
})()
