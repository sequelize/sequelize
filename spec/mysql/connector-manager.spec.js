var buster  = require("buster")
  , Helpers = require('../buster-helpers')
  , dialect = Helpers.getTestDialect()

buster.spec.expose()
buster.testRunner.timeout = 1000

var sequelize = Helpers.createSequelizeInstance({dialect: dialect})

if (dialect.match(/^mysql/)) {
  describe('[MYSQL] Connector Manager', function() {
    before(function(done) {
      this.sequelize = sequelize
      Helpers.clearDatabase(this.sequelize, done)
    })

    it('works correctly after being idle', function(done) {
      this.timeout = 1000 * 10
      var User = this.sequelize.define('User', { username: Helpers.Sequelize.STRING })
      , spy = this.spy()

      User.sync({force: true}).on('success', function() {
        User.create({username: 'user1'}).on('success', function() {
          User.count().on('success', function(count) {
            expect(count).toEqual(1)
            spy()

            setTimeout(function() {
              User.count().on('success', function(count) {
                expect(count).toEqual(1)
                spy()
                if (spy.calledTwice) {
                  done()
                }
              })
            }, 1000)
          })
        })
      })
    })
  })
}
