var assert          = require("assert")
  , ModelDefinition = require("./../../lib/model-definition")

module.exports = {
  'mixin should be correctly added to the model': function() {
    assert.isDefined(ModelDefinition.prototype.hasOne)
    assert.isDefined(ModelDefinition.prototype.hasMany)
    assert.isDefined(ModelDefinition.prototype.belongsTo)
  }
}
