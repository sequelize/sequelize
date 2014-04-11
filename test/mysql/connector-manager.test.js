var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , sinon     = require('sinon')
  , DataTypes = require(__dirname + "/../../lib/data-types")

chai.config.includeStack = true

if (Support.dialectIsMySQL()) {
  describe('[MYSQL Specific] Connector Manager', function() {
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

    it('accepts new queries after shutting down a connection', function(done) {
      // Create a sequelize instance with pooling disabled
      var sequelize = Support.createSequelizeInstance({ pool: false })
      var User = sequelize.define('User', { username: DataTypes.STRING })

      User.sync({force: true}).on('success', function() {
        User.create({username: 'user1'}).on('success', function() {
          // After 100 ms the DB connection will be disconnected for inactivity
          setTimeout(function() {
            // This query will be queued just after the `client.end` is executed and before its callback is called
            sequelize.query('SELECT COUNT(*) AS count FROM Users').on('success', function(count) {
              expect(count[0].count).to.equal(1)
              done()
            }).error(function(error) {
              expect(error).to.not.exist
            })
          }, 100)
        })
      })
    })
  })
}
