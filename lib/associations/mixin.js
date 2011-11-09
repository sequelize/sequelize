var Utils = require("./../utils")

/* Defines Mixin for all models. */
var Mixin = module.exports = function(){}

Mixin.hasOne = function(associatedModel, options) {
  // the id is in the foreign table
  var HasOne = require('./has-one')
  var association = new HasOne(this, associatedModel, Utils._.extend((options||{}), this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()
}
Mixin.belongsTo = function(associatedModel, options) {
  // the id is in this table
  var BelongsTo = require("./belongs-to")
  var association = new BelongsTo(this, associatedModel, Utils._.extend((options||{}), this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()
}
Mixin.hasMany = function(associatedModel, options) {
  // the id is in the foreign table or in a connecting table
  var HasMany = require("./has-many")
  var association = new HasMany(this, associatedModel, Utils._.extend((options||{}), this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()
}

/* example for instance methods:
  Mixin.prototype.test = function() {
    console.log('asd')
  }
*/
