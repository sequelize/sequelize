var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { pool: config.mysql.pool, port: config.mysql.port, utcoffset: '+0:00', logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

//////////////////
// event testing

var connected = false
var connectedViaConnectorManager = false
sequelize.on( 'connect', function() {
  connected = true
})
sequelize.connectorManager.on( 'connect', function() {
  connectedViaConnectorManager = true
})

var disconnected = false
var disconnectedViaConnectorManager = false
sequelize.on( 'disconnect', function() {
  disconnected = true
})
sequelize.connectorManager.on( 'disconnect', function() {
  disconnectedViaConnectorManager = true
})  
//
//////////////////


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
          }).on('error', function() {
            expect(false).toEqual(true)
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
        }).on('failure', function() {
          expect(false).toEqual(true)
          done()
        })
      }, 1000)
    })
  })

  it('emits a connect event', function() {
    Helpers.async(function(done) {
      setTimeout(function() {
        expect(connected).toEqual(true)
        expect(connectedViaConnectorManager).toEqual(true)
        done()
      }, 1000)
    })
  })

  it('emits a disconnect event', function() {
    Helpers.async(function(done) {
      setTimeout(function() {
        expect(disconnected).toEqual(true)
        expect(disconnectedViaConnectorManager).toEqual(true)
        done()
      }, 1000)
    })
  })
  
  it('properly set timezone', function() {
    Helpers.async(function(done) {
      sequelize.query( "SELECT @@session.time_zone", null, {raw: true}).on('success', function( results ) {

        expect(results.length).toEqual(1);
        var result = results[0]        
        var re = new RegExp( /(.)(\d+)\:(\d+)/ )
        var match = re.exec( result[ '@@session.time_zone' ] )
        expect(match).not.toBeNull()
        if (!match) {
          done()
          return
        }

        expect(match.length).toEqual(4)
        if (match.length != 4) {
          done()
          return
        }

        var dbSign = match[1]
        var dbHours = parseInt(match[2])
        var dbMinutes = parseInt(match[3])

        match = re.exec( sequelize.config.utcoffset )
        expect(match).not.toBeNull()
        if (!match) {
          done()
          return
        }

        expect(match.length).toEqual(4)
        if (match.length != 4) {
          done()
          return
        }

        var configSign = match[1]
        var configHours = parseInt(match[2]) 
        var configMinutes = parseInt(match[3]) 

        expect(dbSign + dbHours + dbMinutes).toEqual(configSign + configHours + configMinutes)
        done()
      }).on( 'error', function() {
        expect(true).toEqual(false);
        done()
      })
    })
  })
})
