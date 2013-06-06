if(typeof require === 'function') {
  const buster             = require("buster")
      , CustomEventEmitter = require("../lib/emitters/custom-event-emitter")
      , Helpers            = require('./buster-helpers')
      , dialect            = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1000

var Sequelize = require(__dirname + '/../index')

describe(Helpers.getTestDialectTeaser("Configuration"), function() {
  describe('Instantiation with a URL string', function() {
    it('should accept username, password, host, port, and database', function() {
      var sequelize = new Sequelize('mysql://user:pass@example.com:9821/dbname')
      var config = sequelize.config
      var options = sequelize.options

      expect(options.dialect).toEqual('mysql')

      expect(config.database).toEqual('dbname')
      expect(config.host).toEqual('example.com')
      expect(config.username).toEqual('user')
      expect(config.password).toEqual('pass')
      expect(config.port).toEqual(9821)
    })

    it('should work with no authentication options', function() {
      var sequelize = new Sequelize('mysql://example.com:9821/dbname')
      var config = sequelize.config

      expect(config.username).toEqual(undefined)
      expect(config.password).toEqual(null)
    })

    it('should use the default port when no other is specified', function() {
      var sequelize = new Sequelize('mysql://example.com/dbname')
      var config = sequelize.config

      // The default port should be set
      expect(config.port).toEqual(3306)
    })
  })

  describe('Intantiation with arguments', function() {
    it('should accept two parameters (database, username)', function() {
      var sequelize = new Sequelize('dbname', 'root')
      var config = sequelize.config

      expect(config.database).toEqual('dbname')
      expect(config.username).toEqual('root')
    })

    it('should accept three parameters (database, username, password)', function() {
      var sequelize = new Sequelize('dbname', 'root', 'pass')
      var config = sequelize.config

      expect(config.database).toEqual('dbname')
      expect(config.username).toEqual('root')
      expect(config.password).toEqual('pass')
    })

    it('should accept four parameters (database, username, password, options)', function() {
      var sequelize = new Sequelize('dbname', 'root', 'pass', { port: 999 })
      var config = sequelize.config

      expect(config.database).toEqual('dbname')
      expect(config.username).toEqual('root')
      expect(config.password).toEqual('pass')
      expect(config.port).toEqual(999)
    })
  })
})
