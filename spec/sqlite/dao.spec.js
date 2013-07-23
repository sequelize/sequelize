var buster  = require("buster")
  , Helpers = require('../buster-helpers')
  , dialect = Helpers.getTestDialect()
  , DataTypes = require(__dirname + "/../../lib/data-types")

buster.spec.expose()
buster.testRunner.timeout = 1000

var sequelize = Helpers.createSequelizeInstance({dialect: dialect})

if (dialect === 'sqlite') {
  describe('[SQLITE] DAO', function() {
    before(function(done) {
      var self = this
      this.sequelize = sequelize
      Helpers.clearDatabase(this.sequelize, function() {
        self.User = sequelize.define('User', {
          username: DataTypes.STRING
        })
        self.User.sync({ force: true }).success(done)
      })
    })

    describe('findAll', function() {
      it("handles dates correctly", function(done) {
        var self = this

        this.User
          .create({ username: 'user', createdAt: new Date(2011, 04, 04) })
          .success(function() {
            self.User.create({ username: 'new user' }).success(function() {
              self.User.findAll({
                where: ['createdAt > ?', new Date(2012, 01, 01)]
              }).success(function(users) {
                expect(users.length).toEqual(1)
                done()
              })
            })
          })
      })
    })
  })
}
