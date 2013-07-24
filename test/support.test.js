var Support   = require(__dirname + '/support')
  , dialect   = Support.getTestDialect()

before(function(done) {
  var sequelize = Support.createSequelizeInstance({ dialect: dialect })
  this.sequelize = sequelize
  done()
})

beforeEach(function(done) {
  Support.clearDatabase(this.sequelize, done)
})
