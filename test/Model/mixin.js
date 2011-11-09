var assert       = require("assert")
  , ModelFactory = require("./../../lib/model-factory")

module.exports = {
  'mixin should be correctly added to the model': function() {
    assert.isDefined(ModelFactory.prototype.hasOne)
    assert.isDefined(ModelFactory.prototype.hasMany)
    assert.isDefined(ModelFactory.prototype.belongsTo)
  }
}
