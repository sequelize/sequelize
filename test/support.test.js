var Support   = require(__dirname + '/support')
  , dialect   = Support.getTestDialect()

var sequelize = Support.createSequelizeInstance({ dialect: dialect })

before(function(done) {
  this.sequelize = sequelize
  done()
})

afterEach(function(done) {
  Support.clearDatabase(this.sequelize, done)
})
