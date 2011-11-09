var assert    = require("assert")
  , config = require("./../config")
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
    var User = sequelize.define('User' + config.rand(), {
      username: {type: Sequelize.STRING, unique: true}
    }, { timestamps: false })
    assert.eql(User.attributes, {username:"VARCHAR(255) UNIQUE",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  },
  'it should handle extended attributes correctly - default': function() {
    var User = sequelize.define('User' + config.rand(), {
      username: {type: Sequelize.STRING, defaultValue: 'foo'}
    }, { timestamps: false })
    assert.eql(User.attributes, {username:"VARCHAR(255) DEFAULT 'foo'",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  },
  'it should handle extended attributes correctly - null': function() {
    var User = sequelize.define('User' + config.rand(), {
      username: {type: Sequelize.STRING, allowNull: false}
    }, { timestamps: false })
    assert.eql(User.attributes, {username:"VARCHAR(255) NOT NULL",id:"INT NOT NULL auto_increment PRIMARY KEY"})
  },
  'it should handle extended attributes correctly - primary key': function() {
    var User = sequelize.define('User' + config.rand(), {
      username: {type: Sequelize.STRING, primaryKey: true}
    }, { timestamps: false })
    assert.eql(User.attributes, {username:"VARCHAR(255) PRIMARY KEY"})
  },
  'primaryKeys should be correctly determined': function() {
    var User = sequelize.define('User' + config.rand(), {
      foo: {type: Sequelize.STRING, primaryKey: true},
      bar: Sequelize.STRING
    })
    assert.eql(User.primaryKeys, {"foo":"VARCHAR(255) PRIMARY KEY"})
  },
  'it should add updatedAt and createdAt if timestamps is undefined or true': function() {
    var User1 = sequelize.define('User' + config.rand(), {})
    var User2 = sequelize.define('User' + config.rand(), {}, { timestamps: true })

    assert.eql(User1.attributes, {id:"INT NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
    assert.eql(User2.attributes, {id:"INT NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
  },
  'it should add deletedAt if paranoid is true': function() {
    var User = sequelize.define('User' + config.rand(), {}, { paranoid: true })
    assert.eql(User.attributes, {id:"INT NOT NULL auto_increment PRIMARY KEY", deletedAt:"DATETIME", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
  },
  'timestamp columns should be underscored if underscored is passed': function() {
    var User = sequelize.define('User' + config.rand(), {}, { paranoid: true, underscored: true })
    assert.eql(User.attributes, {id:"INT NOT NULL auto_increment PRIMARY KEY", deleted_at:"DATETIME", updated_at:"DATETIME NOT NULL", created_at:"DATETIME NOT NULL"})
  },
  'tablenames should be as passed if they are frozen': function() {
    var User = sequelize.define('User', {}, {freezeTableName: true})
    assert.eql(User.tableName, 'User')
  },
  'tablenames should be pluralized if they are not frozen': function() {
    var User = sequelize.define('User', {}, {freezeTableName: false})
    assert.eql(User.tableName, 'Users')
  },
  'it should add the passed class/instance methods': function() {
    var User = sequelize.define('User', {}, {
      classMethods: { doSmth: function(){ return 1 } },
      instanceMethods: { makeItSo: function(){ return 2}}
    })
    assert.isDefined(User.doSmth)
    assert.eql(User.doSmth(), 1)
    assert.isUndefined(User.makeItSo)

    assert.isDefined(User.build().makeItSo)
    assert.eql(User.build().makeItSo(), 2)
  },
  'it shouldn\'t allow two auto increment fields': function() {
    assert.throws(function () {
      var User = sequelize.define('User', {
        userid: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        userscore: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
      })
    })
  }
}
