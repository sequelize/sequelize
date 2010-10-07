/*
  Title: Default values

  This example demonstrates the use of default values for defined model fields. Instead of just specifying the datatype,
  you have to pass a hash with a type and a default. You also might want to specify either an attribute can be null or not!
*/

var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "root", null),
    User      = sequelize.define('User', {
      name: { type: Sequelize.STRING, allowNull: false},
      isAdmin: { type: Sequelize.BOOLEAN, allowNull: false, default: false }
    }),
    user      = new User({ name: 'Someone' })
    
Sequelize.chainQueries([{drop: User}, {sync: User}], function() {
  user.save(function(user) {
    Sequelize.Helper.log("user.isAdmin should be the default value (false): " + user.isAdmin)
    
    user.updateAttributes({ isAdmin: true }, function(user) {
      Sequelize.Helper.log("user.isAdmin was overwritten to true: " + user.isAdmin)
    })
  })
})