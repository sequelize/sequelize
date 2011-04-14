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
    }, { timestamps: false })
    assert.eql(User.attributes, {username:"VARCHAR(255) UNIQUE",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  },
  'it should handle extended attributes correctly - default': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {
      username: {type: Sequelize.STRING, defaultValue: 'foo'}
    }, { timestamps: false })
    assert.eql(User.attributes, {username:"VARCHAR(255) DEFAULT 'foo'",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  },
  'it should handle extended attributes correctly - null': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {
      username: {type: Sequelize.STRING, allowNull: false}
    }, { timestamps: false })
    assert.eql(User.attributes, {username:"VARCHAR(255) NOT NULL",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  },
  'it should handle extended attributes correctly - primary key': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {
      username: {type: Sequelize.STRING, primaryKey: true}
    }, { timestamps: false })
    assert.eql(User.attributes, {username:"VARCHAR(255) PRIMARY KEY"})
  },
  'primaryKeys should be correctly determined': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {
      foo: {type: Sequelize.STRING, primaryKey: true},
      bar: Sequelize.STRING
    })
    assert.eql(User.primaryKeys, {"foo":"VARCHAR(255) PRIMARY KEY"})
  },
  'it should add updatedAt and createdAt if timestamps is undefined or true': function() {
    var User1 = sequelize.define('User' + parseInt(Math.random() * 999999999), {})
    var User2 = sequelize.define('User' + parseInt(Math.random() * 999999999), {}, { timestamps: true })
    
    assert.eql(User1.attributes, {id:"INT NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
    assert.eql(User2.attributes, {id:"INT NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
  },
  'it should add deletedAt if paranoid is true': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {}, { paranoid: true })
    assert.eql(User.attributes, {id:"INT NOT NULL auto_increment PRIMARY KEY", deletedAt:"DATETIME", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
  },
  'timestamp columns should be underscored if underscored is passed': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 999999999), {}, { paranoid: true, underscored: true })
    assert.eql(User.attributes, {id:"INT NOT NULL auto_increment PRIMARY KEY", deleted_at:"DATETIME", updated_at:"DATETIME NOT NULL", created_at:"DATETIME NOT NULL"})
  }
}