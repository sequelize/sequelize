var assert    = require("assert")
  , Sequelize = require("./../../index")

module.exports = {
  'it should add a new model to the model-manager': function() {
    var s = new Sequelize('database', 'username', 'password')
    assert.eql(s.modelManager.all.length, 0)
    s.define('foo', { title: Sequelize.STRING })
    assert.eql(s.modelManager.all.length, 1)
  },
  'it should handle extended attributes': function() {
    var s = new Sequelize('database', 'username', 'password')
    var User = s.define('User', {
      name: Sequelize.STRING,
      username: {type: Sequelize.STRING, unique: true},
      password: {type: Sequelize.STRING, default: 'password'}
    })
    assert.eql(User.attributes, {
      name:"VARCHAR(255)",
      username:"VARCHAR(255) UNIQUE",
      password:"VARCHAR(255) DEFAULT 'password'",
      id:"INT NOT NULL auto_increment PRIMARY KEY"
    })
  }
}