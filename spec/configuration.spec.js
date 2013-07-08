if(typeof require === 'function') {
  const buster           = require("buster")
    , semver             = require("semver")
    , CustomEventEmitter = require("../lib/emitters/custom-event-emitter")
    , Helpers            = require('./buster-helpers')
    , config             = require(__dirname + "/config/config")
    , dialect            = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1000

var Sequelize = require(__dirname + '/../index')
  , noDomains = semver.lt(process.version, '0.8.0')

describe(Helpers.getTestDialectTeaser("Configuration"), function() {
  describe('Connections problems should fail with a nice message', function() {
    it('when we don\'t have the correct server details', function(done) {
      if (noDomains === true) {
        console.log('WARNING: Configuration specs requires NodeJS version >= 0.8 for full compatibility')
        expect('').toEqual('') // Silence Buster!
        return done()
      }

      var sequelize = new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {storage: '/path/to/no/where/land', logging: false, host: '0.0.0.1', port: config[dialect].port, dialect: dialect})
        , domain = require('domain')
        , d = domain.create()

      d.on('error', function(err){
        var msg = 'Failed to find SQL server. Please double check your settings.'
        if (dialect === "postgres" || dialect === "postgres-native") {
          msg = 'Failed to find PostgresSQL server. Please double check your settings.'
        }
        else if (dialect === "mysql") {
          msg = 'Failed to find MySQL server. Please double check your settings.'
        }

        expect(err.message).toEqual(msg)
        d.remove(sequelize.query)
        done()
      })

      d.run(function(){
        d.add(sequelize.query)
        sequelize.query('select 1 as hello')
        .success(function(){})
      })
    })

    it('when we don\'t have the correct login information', function(done) {
      if (dialect !== "postgres" && dialect !== "postgres-native" && dialect !== "mysql") {
        console.log('This dialect doesn\'t support me :(')
        expect('').toEqual('') // Silence Buster
        return done()
      }

      if (noDomains === true) {
        console.log('WARNING: Configuration specs requires NodeJS version >= 0.8 for full compatibility')
        expect('').toEqual('') // Silence Buster!
        return done()
      }

      var sequelize = new Sequelize(config[dialect].database, config[dialect].username, 'fakepass123', {logging: false, host: config[dialect].host, port: 1, dialect: dialect})
      , domain = require('domain')
      , d = domain.create()

      d.on('error', function(err){
        var msg = 'Failed to authenticate for SQL. Please double check your settings.'
        if (dialect === "postgres" || dialect === "postgres-native") {
          msg = 'Failed to authenticate for PostgresSQL. Please double check your settings.'
        }
        else if (dialect === "mysql") {
          msg = 'Failed to authenticate for MySQL. Please double check your settings.'
        }

        expect(err.message).toEqual(msg)
        d.remove(sequelize.query)
        done()
      })

      d.run(function(){
        d.add(sequelize.query)
        sequelize.query('select 1 as hello')
        .success(function(){})
      })
    })

    it('when we don\'t have a valid dialect.', function() {
      Helpers.assertException(function() {
        new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {host: '0.0.0.1', port: config[dialect].port, dialect: undefined})
      }.bind(this), 'The dialect undefined is not supported.')
    })
  })

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
