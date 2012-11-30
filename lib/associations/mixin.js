var Utils     = require("./../utils")
  , HasOne    = require('./has-one')
  , HasMany   = require("./has-many")
  , BelongsTo = require("./belongs-to")

/* Defines Mixin for all models. */
var Mixin = module.exports = function(){}

Mixin.hasOne = function(associatedDAO, options) {
  // the id is in the foreign table
  var association = new HasOne(this, associatedDAO, Utils._.extend((options||{}), this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()

  association.injectGetter(this.DAO.prototype);
  association.injectSetter(this.DAO.prototype);

  return this
}

Mixin.belongsTo = function(associatedDAO, options) {
  // the id is in this table
  var association = new BelongsTo(this, associatedDAO, Utils._.extend((options||{}), this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()

  association.injectGetter(this.DAO.prototype);
  association.injectSetter(this.DAO.prototype);

  return this
}

Mixin.hasMany = function(associatedDAO, options) {
  // the id is in the foreign table or in a connecting table
  var association = new HasMany(this, associatedDAO, Utils._.extend((options||{}), this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()

  association.injectGetter(this.DAO.prototype);
  association.injectSetter(this.DAO.prototype);

  return this
}

Mixin.getAssociation = function(target) {
  var result = null

  for (var associationName in this.associations) {
    if (this.associations.hasOwnProperty(associationName)) {
      var association = this.associations[associationName]

      if (!result && (association.target === target)) {
        result = association
      }
    }
  }

  return result
}

Mixin.getAssociationByAlias = function(alias) {
  var result = null

  for (var associationName in this.associations) {
    if (this.associations.hasOwnProperty(associationName)) {
      var association = this.associations[associationName]

      if (!result && (association.options.as === alias)) {
        result = association
      }
    }
  }

  return result
}

/* example for instance methods:
  Mixin.prototype.test = function() {
    console.log('asd')
  }
*/
