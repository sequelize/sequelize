var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
var h = Sequelize.Helper

module.exports = {
  'log should be defined': function(assert) {
    assert.isNotNull(h.log)
    assert.isDefined(h.log)
  },

  'evaluateTemplate': function(assert) {
    assert.equal(h.evaluateTemplate("hallo %{foo}!", {foo: 'welt'}), "hallo welt!")
    assert.equal(h.evaluateTemplate("hallo %{foo}!", {foo: 'welt', bar: 'asd'}), "hallo welt!")
  },
  
  'Inflection: should be available': function(assert) {
    assert.isDefined(h.Inflection)
  },
}