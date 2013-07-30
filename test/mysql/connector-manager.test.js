var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , dialect   = Support.getTestDialect()
  , sinon     = require('sinon')
  , DataTypes = require(__dirname + "/../../lib/data-types")

chai.Assertion.includeStack = true

if (dialect.match(/^mysql/)) {
  describe('[MYSQL Specific] Connector Manager', function() {
    this.timeout(10000)

    it('works correctly after being idle', function(done) {
      var User = this.sequelize.define('User', { username: DataTypes.STRING })
      , spy = sinon.spy()

      User.sync({force: true}).on('success', function() {
        User.create({username: 'user1'}).on('success', function() {
          User.count().on('success', function(count) {
            expect(count).to.equal(1)
            spy()

            setTimeout(function() {
              User.count().on('success', function(count) {
                expect(count).to.equal(1)
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
