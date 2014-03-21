/*
  Title: Default values

  This example demonstrates the use of default values for defined model fields. Instead of just specifying the datatype,
  you have to pass a hash with a type and a default. You also might want to specify either an attribute can be null or not!
*/

var Sequelize = require(__dirname + "/../../index")
  , config    = require(__dirname + "/../../spec/config/config")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

var User = sequelize.define('User', {
      name: { type: Sequelize.STRING, allowNull: false},
      isAdmin: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
    })
  , user = User.build({ name: 'Someone' })

sequelize.sync({force: true}).on('success', function() {
  user.save().on('success', function(user) {
    console.log("user.isAdmin should be the default value (false): ", user.isAdmin)

    user.updateAttributes({ isAdmin: true }).on('success', function(user) {
      console.log("user.isAdmin was overwritten to true: " + user.isAdmin)
    })
  })
}).on('failure', function(err) {
  console.log(err)
})