var Utils     = require("./../utils")
  , HasOne    = require('./has-one')
  , HasMany   = require("./has-many")
  , BelongsTo = require("./belongs-to")

/* Defines Mixin for all models. */
var Mixin = module.exports = function(){}

Mixin.hasOne = function(associatedDAOFactory, options) {
  // Since this is a mixin, we'll need a unique variable name for hooks (since DAOFactory will override our hooks option)
  options = options || {}
  options.hooks = options.hooks === undefined ? false : Boolean(options.hooks)
  options.useHooks = options.hooks

  // the id is in the foreign table
  var association = new HasOne(this, associatedDAOFactory, Utils._.extend(options, this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()

  association.injectGetter(this.DAO.prototype);
  association.injectSetter(this.DAO.prototype);
  association.injectCreator(this.DAO.prototype);

  return this
}

Mixin.belongsTo = function(associatedDAOFactory, options) {
  // Since this is a mixin, we'll need a unique variable name for hooks (since DAOFactory will override our hooks option)
  options = options || {}
  options.hooks = options.hooks === undefined ? false : Boolean(options.hooks)
  options.useHooks = options.hooks

  // the id is in this table
  var association = new BelongsTo(this, associatedDAOFactory, Utils._.extend(options, this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()

  association.injectGetter(this.DAO.prototype)
  association.injectSetter(this.DAO.prototype)
  association.injectCreator(this.DAO.prototype)

  return this
}

Mixin.hasMany = function(associatedDAOFactory, options) {
  // Since this is a mixin, we'll need a unique variable name for hooks (since DAOFactory will override our hooks option)
  options = options || {}
  options.hooks = options.hooks === undefined ? false : Boolean(options.hooks)
  options.useHooks = options.hooks

  options = Utils._.extend(options, Utils._.omit(this.options, ['hooks']))

  // the id is in the foreign table or in a connecting table
  var association = new HasMany(this, associatedDAOFactory, options)
  this.associations[association.associationAccessor] = association.injectAttributes()

  association.injectGetter(this.DAO.prototype)
  association.injectSetter(this.DAO.prototype)
  association.injectCreator(this.DAO.prototype)

  return this
}

Mixin.getAssociation = function(target, alias) {
  for (var associationName in this.associations) {
    if (this.associations.hasOwnProperty(associationName)) {
      var association = this.associations[associationName]

      if (association.target === target && (alias === undefined ? !association.isAliased : association.as === alias)) {
        return association
      }
    }
  }

  return null
}

Mixin.getAssociationByAlias = function(alias) {
  for (var associationName in this.associations) {
    if (this.associations.hasOwnProperty(associationName)) {
      var association = this.associations[associationName]

      if (association.as === alias) {
        return association
      }
    }
  }

  return null
}

/* example for instance methods:
  Mixin.prototype.test = function() {
    console.log('asd')
  }
*/
