var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

var initUsers = function(num, callback) {
  return sequelize.define('User' + config.rand(), { name: Sequelize.STRING, bio: Sequelize.TEXT })
}

module.exports = {
  'do not allow duplicated records with unique:true': function(exit) {
    var User = sequelize.define('User' + config.rand(), {
       username: {type: Sequelize.STRING, unique: true}
     })
     User.sync({force:true}).on('success', function() {
       User.create({username:'foo'}).on('success', function() {
          User.create({username: 'foo'}).on('failure', function(err) {
            assert.eql(err.message, "Duplicate entry 'foo' for key 'username'")
            exit(function(){})
          })
        })
     })
  },
  'it should raise an error if created object breaks definition constraints': function(exit) {
    var User = sequelize.define('User' + config.rand(), {
      username: {type: Sequelize.STRING, unique: true},
      smth: {type: Sequelize.STRING, allowNull: false}
    })
    User.sync({force:true}).on('success', function() {
      User.create({username: 'foo', smth: null}).on('failure', function(err) {
        assert.eql(err.message, "Column 'smth' cannot be null")
        User.create({username: 'foo', smth: 'foo'}).on('success', function() {
          User.create({username: 'foo', smth: 'bar'}).on('failure', function(err) {
            assert.eql(err.message, "Duplicate entry 'foo' for key 'username'")
            exit(function(){})
          })
        })
      })
    })
  },
  'it should set the auto increment field to the insert id': function(exit) {
    var User = sequelize.define('User' + config.rand(), {
      userid: {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false}
    })
    User.sync({force:true}).on('success', function() {
      User.create({}).on('success', function(user) {
        assert.eql(user.userid, 1)
        exit(function(){})
      })
    })
  }
}