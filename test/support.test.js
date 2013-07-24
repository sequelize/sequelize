var Support   = require(__dirname + '/support')
  , dialect   = Support.getTestDialect()

before(function(done) {
  var sequelize = Support.createSequelizeInstance({ dialect: dialect })
  this.sequelize = sequelize

  Support.clearDatabase(this.sequelize, done)
})
