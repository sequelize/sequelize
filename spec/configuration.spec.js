var buster           = require("buster")
  , semver             = require("semver")
  , Helpers            = require('./buster-helpers')
  , config             = require(__dirname + "/config/config")
  , dialect            = Helpers.getTestDialect()

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
        expect(err).toMatch(/Failed to find (.*?) Please double check your settings\./)
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
        expect(err).toMatch(/^Failed to authenticate/)
        d.remove(sequelize)
        done()
      })

      d.run(function(){
        d.add(sequelize)
        sequelize.query('select 1 as hello')
        .success(function(){})
      })
    })

    it('when we don\'t have a valid dialect.', function(done) {
      expect(function() {
        new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {host: '0.0.0.1', port: config[dialect].port, dialect: undefined})
      }).toThrow('Error', 'The dialect undefined is not supported.')
      done()
    })
  })

  describe('Instantiation with a URL string', function() {
    it('should accept username, password, host, port, and database', function(done) {
      var sequelize = new Sequelize('mysql://user:pass@example.com:9821/dbname')
      var config = sequelize.config
      var options = sequelize.options

      expect(options.dialect).toEqual('mysql')

      expect(config.database).toEqual('dbname')
      expect(config.host).toEqual('example.com')
      expect(config.username).toEqual('user')
      expect(config.password).toEqual('pass')
      expect(config.port).toEqual(9821)
      done()
    })

    it('should work with no authentication options', function(done) {
      var sequelize = new Sequelize('mysql://example.com:9821/dbname')
      var config = sequelize.config

      expect(config.username).toEqual(undefined)
      expect(config.password).toEqual(null)
      done()
    })

    it('should use the default port when no other is specified', function(done) {
      var sequelize = new Sequelize('mysql://example.com/dbname')
      var config = sequelize.config

      // The default port should be set
      expect(config.port).toEqual(3306)
      done()
    })
  })

  describe('Intantiation with arguments', function() {
    it('should accept two parameters (database, username)', function(done) {
      var sequelize = new Sequelize('dbname', 'root')
      var config = sequelize.config

      expect(config.database).toEqual('dbname')
      expect(config.username).toEqual('root')
      done()
    })

    it('should accept three parameters (database, username, password)', function(done) {
      var sequelize = new Sequelize('dbname', 'root', 'pass')
      var config = sequelize.config

      expect(config.database).toEqual('dbname')
      expect(config.username).toEqual('root')
      expect(config.password).toEqual('pass')
      done()
    })

    it('should accept four parameters (database, username, password, options)', function(done) {
      var sequelize = new Sequelize('dbname', 'root', 'pass', { port: 999 })
      var config = sequelize.config

      expect(config.database).toEqual('dbname')
      expect(config.username).toEqual('root')
      expect(config.password).toEqual('pass')
      expect(config.port).toEqual(999)
      done()
    })
  })
})
