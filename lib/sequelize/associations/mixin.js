/*
  Defines Mixin for all models.
*/
var Associations = module.exports = {
  classMethods: {
    hasOne: function(associationName, associatedModel) {
      // the id is in the foreign table
      var HasOne = require('./has-one')
      var association = new HasOne(association, this, associatedModel, this.options)
      this.associations[associationName] = association.injectAttributes()
    },
    belongsTo: function(associationName, associatedModel) {
      // the id is in this table
      var BelongsTo = require("./belongs-to")
      var association = new BelongsTo(associationName, this, associatedModel, this.options)
      this.associations[associationName] = association.injectAttributes()
    },
    hasMany: function(associationName, associatedModel, options) {
      // the id is in the foreign table or in a connecting table
    }
  },
  instanceMethods: {
    
  }
}

