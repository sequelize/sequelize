var Utils       = require("./../utils")
  , Helpers     = require('./helpers')
  , Transaction = require('../transaction')
  
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
      this.options.foreignKey = Utils._.camelizeIf(
        [
          Utils._.underscoredIf(this.as, this.source.options.underscored),
          this.target.primaryKeyAttribute
        ].join("_"),
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

    newAttributes[this.identifier] = { type: this.options.keyType || this.target.rawAttributes[this.targetIdentifier].type }
    if (this.options.constraints !== false) {
      this.options.onDelete = this.options.onDelete || 'SET NULL'
      this.options.onUpdate = this.options.onUpdate || 'CASCADE'
    }
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
      var where = {}

      params = params || {}
      params.where = (params.where && [params.where]) || []

      where[association.targetIdentifier] = this.get(association.identifier)
      params.where.push(where)

      params.where = new Utils.and(params.where)

      return association.target.find(params)
    }

    return this
  }

  // Add setAssociaton method to the prototype of the model instance
  BelongsTo.prototype.injectSetter = function(instancePrototype) {
    var association = this

    instancePrototype[this.accessors.set] = function(associatedInstance, options) {
      this.set(association.identifier, associatedInstance ? associatedInstance[association.targetIdentifier] : null)

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

      return association.target.create(values, fieldsOrOptions).then(function(newAssociatedObject) {
        return instance[association.accessors.set](newAssociatedObject, options)
      })
    }

    return this
  }

  return BelongsTo
})()
