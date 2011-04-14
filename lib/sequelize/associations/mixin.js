/*
  Defines Mixin for all models.
*/
var Associations = module.exports = {
  classMethods: {
    hasOne: function(associationName, associatedModel, options) {
      // the id is in the foreign table
    },
    hasMany: function(associationName, associatedModel, options) {
      // the id is in the foreign table or in a connecting table
    },
    belongsTo: function(associationName, associatedModel, options) {
      // the id is in this table
      var BelongsTo = require("./belongs-to")
      var association = new BelongsTo(associationName, this, associatedModel, this.options)
      this.associations[associationName] = association.injectAttributes()
    }
  },
  instanceMethods: {
    
  }
}

