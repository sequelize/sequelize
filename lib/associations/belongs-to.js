var Utils       = require("./../utils")
  , DataTypes   = require('./../data-types')
  , Helpers     = require('./helpers')
  , Transaction = require('../transaction')
  , _           = require('lodash')

module.exports = (function() {
  var BelongsTo = function(source, target, options) {
    this.associationType      = 'BelongsTo'
    this.source               = source
    this.target               = target
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
      console.log(this.as);
      this.options.foreignKey = Utils._.camelizeIf(
        [this.as, this.target.primaryKeyAttribute].join("_"),
        !this.source.options.underscored
      )
    }

    this.identifier = this.options.foreignKey
    this.targetIdentifier = this.target.primaryKeyAttribute
    this.associationAccessor = this.as
    this.options.useHooks = options.useHooks

    this.accessors = {
      get: Utils._.camelize('get_' + this.as),
      set: Utils._.camelize('set_' + this.as),
      create: Utils._.camelize('create_' + this.as)
    }
  }

  // the id is in the source table
  BelongsTo.prototype.injectAttributes = function() {
    var newAttributes  = {}
      , keyType        = this.target.rawAttributes[this.targetIdentifier].type

    newAttributes[this.identifier] = { type: this.options.keyType || keyType }
    Helpers.addForeignKeyConstraints(newAttributes[this.identifier], this.target, this.source, this.options)
    Utils._.defaults(this.source.rawAttributes, newAttributes)

    // Sync attributes and setters/getters to DAO prototype
    this.source.refreshAttributes()

    return this
  }

  // Add getAssociation method to the prototype of the model instance
  BelongsTo.prototype.injectGetter = function(instancePrototype) {
    var association = this

    instancePrototype[this.accessors.get] = function(params) {
      params = params || {}
      params.where = params.where || {}
      params.where[association.targetIdentifier] = this.get(association.identifier)

      return association.target.find(params)
    }

    return this
  }

  // Add setAssociaton method to the prototype of the model instance
  BelongsTo.prototype.injectSetter = function(instancePrototype) {
    var association = this

    instancePrototype[this.accessors.set] = function(instance, options) {
      this.set(association.identifier, instance ? instance[association.targetIdentifier] : null)

      options = Utils._.extend({
        fields: [ association.identifier ],
        allowNull: [association.identifier ],
        association: true
      }, options)

      // passes the changed field to save, so only that field get updated.
      return this.save(options)
    }

    return this
  }

  // Add createAssociation method to the prototype of the model instance
  BelongsTo.prototype.injectCreator = function(instancePrototype) {
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
          .success(function(newAssociatedObject) {
            instance[association.accessors.set](newAssociatedObject, options)
              .proxy(emitter)
          })
      }).run()
    }

    return this
  }

  return BelongsTo
})()
