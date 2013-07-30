var chai      = require('chai')
  , expect    = chai.expect
  , config    = require(__dirname + "/config/config")
  , Support   = require(__dirname + '/support')
  , dialect   = Support.getTestDialect()
  , Sequelize = require(__dirname + '/../index')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Configuration"), function() {
  describe('Connections problems should fail with a nice message', function() {
    it("when we don't have the correct server details", function(done) {
      // mysql is not properly supported due to the custom pooling system
      if (dialect !== "postgres" && dialect !== "postgres-native") {
        console.log('This dialect doesn\'t support me :(')
        expect(true).to.be.true // Silence Buster
        return done()
      }

      var seq = new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {storage: '/path/to/no/where/land', logging: false, host: '0.0.0.1', port: config[dialect].port, dialect: dialect})
      seq.query('select 1 as hello').error(function(err) {
        expect(err.message).to.match(/Failed to find (.*?) Please double check your settings\./)
        done()
      })
    })

    it('when we don\'t have the correct login information', function(done) {
      if (dialect !== "postgres" && dialect !== "postgres-native") {
        console.log('This dialect doesn\'t support me :(')
        expect(true).to.be.true // Silence Buster
        return done()
      }

      var seq = new Sequelize(config[dialect].database, config[dialect].username, 'fakepass123', {logging: false, host: config[dialect].host, port: 1, dialect: dialect})
      seq.query('select 1 as hello').error(function(err) {
        expect(err.message).to.match(/^Failed to authenticate/)
        done()
      })
    })

    it('when we don\'t have a valid dialect.', function(done) {
      expect(function() {
        new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {host: '0.0.0.1', port: config[dialect].port, dialect: undefined})
      }).to.throw(Error, 'The dialect undefined is not supported.')
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
