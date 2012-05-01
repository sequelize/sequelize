var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { pool: config.mysql.pool, port: config.mysql.port, utcoffset: '+0:00', logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('ConnectorManager', function() {
  beforeEach(function() {
    Helpers.dropAllTables()
  })

  afterEach(function() {
    Helpers.dropAllTables()
  })

  it('works correctly after being idle', function() {
    var User = sequelize.define('User', { username: Sequelize.STRING })

    Helpers.async(function(done) {
      User.sync({force: true}).on('success', function() {
        User.create({username: 'user1'}).on('success', function() {
          User.count().on('success', function(count) {
            expect(count).toEqual(1)
            done()
          })
        })
      })
    })

    Helpers.async(function(done) {
      setTimeout(function() {
        User.count().on('success', function(count) {
          expect(count).toEqual(1)
          done()
        })
      }, 1000)
    })
  })

  it('emits a connect event', function() {
    Helpers.async(function(done) {
      setTimeout(function() {
        expect(self.connected).toEqual(true)
        expect(self.connectedViaConnectorManager).toEqual(true)
        done()
      }, 1000)
    })
  })

  it('emits a disconnect event', function() {
    Helpers.async(function(done) {
      setTimeout(function() {
        expect(self.disconnected).toEqual(true)
        expect(self.disconnectedViaConnectorManager).toEqual(true)
        done()
      }, 1000)
    })
  })
  
  it('properly set timezone', function() {
    Helpers.async(function(done) {
      sequelize.connectorManager.client.query( "SELECT @@session.time_zone", function(error, result) {
        expect(error).toEqual(null)

        var re = new RegExp( '(.)(\d+)\:(\d+)' )
        var match = re.exec( result[ '@@session.time_zone' ] )
        expect(match).not.toBeNull()

        var dbSign = match[1]
        var dbHours = parseInt(match[2])
        var dbMinutes = parseInt(match[3])
        
        match = re.exec( sequelize.config.utcoffset )
        var configSign = result[0];
        var configHours = parseInt(result[1] + result[2], 10)
        var configMinutes = parseInt(result[4] + result[5], 10)

        expect(dbSign + dbHours + dbMinutes).toEqual(configSign + configHours + configMinutes)
        done()
      })
    })
  })
})
