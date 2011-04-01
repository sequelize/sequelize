var assert    = require("assert")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize('database', 'username', 'password')

module.exports = {
  'it should add a new model to the model-manager': function() {
    var s = new Sequelize('database', 'username', 'password')
    assert.eql(s.modelManager.all.length, 0)
    s.define('foo', { title: Sequelize.STRING })
    assert.eql(s.modelManager.all.length, 1)
  },
  'it should handle extended attributes correctly - unique': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {
      username: {type: Sequelize.STRING, unique: true}
    })
    assert.eql(User.attributes, {username:"VARCHAR(255) UNIQUE",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  },
  'it should handle extended attributes correctly - default': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {
      username: {type: Sequelize.STRING, defaultValue: 'foo'}
    })
    assert.eql(User.attributes, {username:"VARCHAR(255) DEFAULT 'foo'",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  },
  'it should handle extended attributes correctly - null': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {
      username: {type: Sequelize.STRING, allowNull: false}
    })
    assert.eql(User.attributes, {username:"VARCHAR(255) NOT NULL",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  },
  'it should handle extended attributes correctly - primary key': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {
      username: {type: Sequelize.STRING, primaryKey: true}
    })
    assert.eql(User.attributes, {username:"VARCHAR(255) PRIMARY KEY",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  }
}