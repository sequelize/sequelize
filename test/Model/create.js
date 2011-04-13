var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

var initUsers = function(num, callback) {
  return sequelize.define('User' + parseInt(Math.random() * 99999999), { name: Sequelize.STRING, bio: Sequelize.TEXT })
}

module.exports = {
  'do not allow duplicated records with unique:true': function(exit) {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), {
       username: {type: Sequelize.STRING, unique: true}
     })
     User.sync({force:true}).on('success', function() {
       User.create({username:'foo'}).on('success', function() {
          User.create({username: 'foo'}).on('failure', function(err) {
            assert.eql(err.message, "Duplicate entry 'foo' for key 'username'")
            exit()
          })
        })
     })
  },
  'it should raise an error if created object breaks definition constraints': function(exit) {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), {
      username: {type: Sequelize.STRING, unique: true},
      smth: {type: Sequelize.STRING, allowNull: false}
    })
    User.sync({force:true}).on('success', function() {
      User.create({username: 'foo', smth: null}).on('failure', function(err) {
        assert.eql(err.message, "Column 'smth' cannot be null")
        User.create({username: 'foo'}).on('failure', function(err) {
          assert.eql(err.message, "Column 'smth' cannot be null")
          exit()
        })
      })
    })
  }
}