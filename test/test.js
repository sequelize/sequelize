var config = require("./config")
  , Sequelize = require("./../index")
  , sequelize = new Sequelize(config.database, config.username, config.password)
  
var User = sequelize.define('User', {
  name: Sequelize.STRING,
  bio: Sequelize.TEXT
})

User.sync({force: true}).on('success', function() {
  User
    .create({name: 'barfooz', bio: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'})
    .on('success', function(user) {
      // User.findAll().on('success', function(users) {
      //   console.log('Found the following users', users.map(function(u) { return u.name }))
      // })
      User.find(user.id).on('success', function(_user) {
        console.log('Found the following user', _user)
      })
    })
})