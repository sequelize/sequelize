var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { port: config.mysql.port, logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('ConnectorManager', function() {
  beforeEach(function() {
    Helpers.dropAllTables()
  })

  afterEach(function() {
    Helpers.dropAllTables()
  })

  //////////////////
  // event testing
  var self = this;
  
  self.connected = false;
  self.connectedViaConnectorManager = false
  sequelize.on( 'connect', function() {
    self.connected = true
  })
  sequelize.connectorManager.on( 'connect', function() {
    self.connectedViaConnectorManager = true
  })  

  self.disconnected = false
  self.disconnectedViaConnectorManager = false
  sequelize.on( 'disconnect', function() {
    self.disconnected = true
  })
  sequelize.connectorManager.on( 'disconnect', function() {
    self.disconnectedViaConnectorManager = true
  })  
  //
  //////////////////
  
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
})
