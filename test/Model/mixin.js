var assert = require("assert")
  , Model  = require("./../../lib/sequelize/model")

module.exports = {
  'mixin should be correctly added to the model': function() {
    assert.isDefined(Model.hasOne)
    assert.isDefined(Model.hasMany)
    assert.isDefined(Model.belongsTo)
  },
  'model methods should be correctly added to the model': function() {
    assert.isDefined(Model.drop)
    assert.isDefined(Model.sync)
    assert.isDefined(Model.prototype.save)
    assert.isDefined(Model.prototype.destroy)
  }
}