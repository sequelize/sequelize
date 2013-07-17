if(typeof require === 'function') {
  const buster  = require("buster")
      , Helpers = require('../buster-helpers')
      , dialect = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1000

if (dialect.match(/^mysql/)) {
  describe('[MYSQL] Connector Manager', function() {
    before(function(done) {
      var self = this

      Helpers.initTests({
        dialect: dialect,
        beforeComplete: function(sequelize, DataTypes) {
          self.sequelize = sequelize
        },
        onComplete: function() {
          self.sequelize.sync({ force: true }).success(done)
        }
      })
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
