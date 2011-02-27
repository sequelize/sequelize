var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
var h = Sequelize.Helper
var assert = require("assert")

module.exports = {
  'log should be defined': function() {
    assert.isNotNull(h.log)
    assert.isDefined(h.log)
  },

  'evaluateTemplate': function() {
    assert.equal(h.evaluateTemplate("hallo %{foo}!", {foo: 'welt'}), "hallo welt!")
    assert.equal(h.evaluateTemplate("hallo %{foo}!", {foo: 'welt', bar: 'asd'}), "hallo welt!")
  },
  
  'Inflection: should be available': function() {
    assert.isDefined(h.Inflection)
  },
}