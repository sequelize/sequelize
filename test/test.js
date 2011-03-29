var config = require("./config")
  , Sequelize = require("./../index")
  , sequelize = new Sequelize(config.database, config.username, config.password)
  
var User = sequelize.define('User', {
  title: Sequelize.STRING,
  bio: Sequelize.TEXT
})

User.sync({force: true}).on('success', function() {
  var user = User.build({title: 'barfooz', bio: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'})
  user.save.on('success', function(u) {
    console.log(u)
    console.log('just saved the user :)')
  })
})


// console.log(user)
// console.log(user.save())