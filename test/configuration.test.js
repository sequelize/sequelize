var chai      = require('chai')
  , expect    = chai.expect
  , semver    = require("semver")
  , config    = require(__dirname + "/config/config")
  , Support   = require(__dirname + '/support')
  , dialect   = Support.getTestDialect()
  , Sequelize = require(__dirname + '/../index')
  , noDomains = semver.lt(process.version, '0.8.0')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Configuration"), function() {
  describe('Connections problems should fail with a nice message', function() {
    it('when we don\'t have the correct server details', function(done) {
      if (noDomains === true) {
        console.log('WARNING: Configuration specs requires NodeJS version >= 0.8 for full compatibility')
        expect('').toEqual('') // Silence Buster!
        return done()
      }

      (function() {
        var sequelizeSpecific2 = new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {storage: '/path/to/no/where/land', logging: false, host: '0.0.0.1', port: config[dialect].port, dialect: dialect})
          , domain = require('domain')
          , d = domain.create()

        d.on('error', function(err){
          expect(err).to.match(/Failed to find (.*?) Please double check your settings\./)
          d.remove(sequelizeSpecific2.query)
          done()
        })

        d.run(function(){
          d.add(sequelizeSpecific2.query)
          sequelizeSpecific2.query('select 1 as hello')
          .success(function(){})
        })
      })()
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

      (function() {
        var sequelizeSpecific1 = new Sequelize(config[dialect].database, config[dialect].username, 'fakepass123', {logging: false, host: config[dialect].host, port: 1, dialect: dialect})
        , domain = require('domain')
        , d = domain.create()

        d.on('error', function(err){
          expect(err).to.match(/^Failed to authenticate/)
          d.remove(sequelizeSpecific1.query)
          done()
        })

        d.run(function(){
          d.add(sequelizeSpecific1.query)
          sequelizeSpecific1.query('select 1 as hello')
          .success(function(){})
        })
      })()
    })

    it('when we don\'t have a valid dialect.', function(done) {
      expect(function() {
        new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {host: '0.0.0.1', port: config[dialect].port, dialect: undefined})
      }).to.throw('The dialect undefined is not supported.')
      done()
    })
  })

  describe('Instantiation with a URL string', function() {
    it('should accept username, password, host, port, and database', function() {
      var sequelize = new Sequelize('mysql://user:pass@example.com:9821/dbname')
      var config = sequelize.config
      var options = sequelize.options

      expect(options.dialect).to.equal('mysql')

      expect(config.database).to.equal('dbname')
      expect(config.host).to.equal('example.com')
      expect(config.username).to.equal('user')
      expect(config.password).to.equal('pass')
      expect(config.port).to.equal('9821')
    })

    it('should work with no authentication options', function(done) {
      var sequelize = new Sequelize('mysql://example.com:9821/dbname')
      var config = sequelize.config

      expect(config.username).to.not.be.ok
      expect(config.password).to.be.null
      done()
    })

    it('should use the default port when no other is specified', function(done) {
      var sequelize = new Sequelize('mysql://example.com/dbname')
      var config = sequelize.config

      // The default port should be set
      expect(config.port).to.equal(3306)
      done()
    })
  })

  describe('Intantiation with arguments', function() {
    it('should accept two parameters (database, username)', function(done) {
      var sequelize = new Sequelize('dbname', 'root')
      var config = sequelize.config

      expect(config.database).to.equal('dbname')
      expect(config.username).to.equal('root')
      done()
    })

    it('should accept three parameters (database, username, password)', function(done) {
      var sequelize = new Sequelize('dbname', 'root', 'pass')
      var config = sequelize.config

      expect(config.database).to.equal('dbname')
      expect(config.username).to.equal('root')
      expect(config.password).to.equal('pass')
      done()
    })

    it('should accept four parameters (database, username, password, options)', function(done) {
      var sequelize = new Sequelize('dbname', 'root', 'pass', { port: 999 })
      var config = sequelize.config

      expect(config.database).to.equal('dbname')
      expect(config.username).to.equal('root')
      expect(config.password).to.equal('pass')
      expect(config.port).to.equal(999)
      done()
    })
  })
})
