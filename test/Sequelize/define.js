var assert    = require("assert")
  , Sequelize = require("./../../index")

module.exports = {
  'it should add a new model to the model-manager': function() {
    var s = new Sequelize('database', 'username', 'password')
    assert.eql(s.modelManager.all.length, 0)
    s.define('foo', { title: Sequelize.STRING })
    assert.eql(s.modelManager.all.length, 1)
  }
}