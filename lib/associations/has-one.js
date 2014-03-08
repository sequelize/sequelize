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
    this.isSelfAssociation    = (this.source == this.target)
    this.as                   = this.options.as

    if (this.as) {
      this.isAliased = true
    } else {
      this.as = Utils.singularize(this.target.name, this.target.options.language)
    }

    if (!this.options.foreignKey) {
      this.options.foreignKey = Utils._.camelizeIf(
        [this.source.name, this.source.primaryKeyAttribute].join("_"),
        !this.source.options.underscored
      )
    }

    this.identifier = this.options.foreignKey
    this.sourceIdentifier = this.source.primaryKeyAttribute
    this.associationAccessor = this.as
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
      , keyType       = this.source.rawAttributes[this.sourceIdentifier].type

    newAttributes[this.identifier] = { type: this.options.keyType || keyType }
    Utils._.defaults(this.target.rawAttributes, newAttributes)

    if (this.options.constraints !== false) {
      this.options.onDelete = this.options.onDelete || 'SET NULL'
      this.options.onUpdate = this.options.onUpdate || 'CASCADE'
    }    
    Helpers.addForeignKeyConstraints(this.target.rawAttributes[this.identifier], this.source, this.target, this.options)

    // Sync attributes and setters/getters to DAO prototype
    this.target.refreshAttributes()
    return this
  }

  HasOne.prototype.injectGetter = function(instancePrototype) {
    var association = this

    instancePrototype[this.accessors.get] = function(params) {
      var where = {}

      params = params || {}
      params.where = [params.where] || []

      where[association.identifier] = this.get(association.sourceIdentifier)
      params.where.push(where)

      params.where = new Utils.and(params.where)

      return association.target.find(params)
    }

    return this
  }

  HasOne.prototype.injectSetter = function(instancePrototype) {
    var association = this

    instancePrototype[this.accessors.set] = function(associatedInstance, options) {
      var instance     = this

      return new Utils.CustomEventEmitter(function(emitter) {
        instance[association.accessors.get]().success(function(oldInstance) {
          if (oldInstance) {
            oldInstance[association.identifier] = null
            oldInstance
              .save(Utils._.extend({}, options, {
                fields:    [association.identifier],
                allowNull: [association.identifier],
                association: true
              }))
              .success(function() {
                if (associatedInstance) {
                  associatedInstance.set(association.identifier, instance.get(association.sourceIdentifier))
                  associatedInstance.save(options).proxy(emitter)
                } else {
                  emitter.emit('success', null)
                }
              })
          } else {
            if (associatedInstance) {
              associatedInstance.set(association.identifier, instance.get(association.sourceIdentifier))
              associatedInstance.save(options).proxy(emitter)
            } else {
              emitter.emit('success', null)
            }
          }
        })
      }).run()
    }

    return this
  }

  HasOne.prototype.injectCreator = function(instancePrototype) {
    var association = this

    instancePrototype[this.accessors.create] = function(values, fieldsOrOptions) {
      var instance = this
        , options = {}

      if ((fieldsOrOptions || {}).transaction instanceof Transaction) {
        options.transaction = fieldsOrOptions.transaction
      }

      return new Utils.CustomEventEmitter(function(emitter) {
        association.target
          .create(values, fieldsOrOptions)
          .proxy(emitter, { events: ['error', 'sql'] })
          .success(function(associationInstance) {
            instance[association.accessors.set](associationInstance, options)
              .proxy(emitter)
          })
      }).run()
    }

    return this
  };

  return HasOne
})()
