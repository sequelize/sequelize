'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , config = require(__dirname + '/../config/config')
  , Support = require(__dirname + '/support')
  , dialect = Support.getTestDialect()
  , Sequelize = require(__dirname + '/../../index');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Configuration'), function() {
  describe('Connections problems should fail with a nice message', function() {
    it("when we don't have the correct server details", function() {
      if (dialect === 'mariadb') {
        console.log('This dialect doesn\'t support me :(');
        expect(true).to.be.true; // Silence Buster
        return;
      }

      var seq = new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {storage: '/path/to/no/where/land', logging: false, host: '0.0.0.1', port: config[dialect].port, dialect: dialect});
      if (dialect === 'sqlite') {
        // SQLite doesn't have a breakdown of error codes, so we are unable to discern between the different types of errors.
        return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(seq.ConnectionError, 'SQLITE_CANTOPEN: unable to open database file');
      } else if (dialect === 'mssql' || dialect === 'postgres') {
        return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith([seq.HostNotReachableError, seq.InvalidConnectionError]);
      } else {
        return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(seq.InvalidConnectionError, 'connect EINVAL');
      }
    });

    it('when we don\'t have the correct login information', function() {
      if (dialect === 'mariadb') {
        console.log('This dialect doesn\'t support me :(');
        expect(true).to.be.true; // Silence Buster
        return;
      }

      if (dialect === 'mssql') {
        // NOTE: Travis seems to be having trouble with this test against the
        //       AWS instance. Works perfectly fine on a local setup.
        expect(true).to.be.true;
        return;
      }

      var seq = new Sequelize(config[dialect].database, config[dialect].username, 'fakepass123', {logging: false, host: config[dialect].host, port: 1, dialect: dialect});
      if (dialect === 'sqlite') {
        // SQLite doesn't require authentication and `select 1 as hello` is a valid query, so this should be fulfilled not rejected for it.
        return expect(seq.query('select 1 as hello')).to.eventually.be.fulfilled;
      } else {
        return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(seq.ConnectionRefusedError, 'connect ECONNREFUSED');
      }
    });

    it('when we don\'t have a valid dialect.', function() {
      expect(function() {
        new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {host: '0.0.0.1', port: config[dialect].port, dialect: undefined});
      }).to.throw(Error, 'The dialect undefined is not supported.');
    });
  });

  describe('Instantiation with a URL string', function() {
    it('should accept username, password, host, port, and database', function() {
      var sequelize = new Sequelize('mysql://user:pass@example.com:9821/dbname');
      var config = sequelize.config;
      var options = sequelize.options;

      expect(options.dialect).to.equal('mysql');

      expect(config.database).to.equal('dbname');
      expect(config.host).to.equal('example.com');
      expect(config.username).to.equal('user');
      expect(config.password).to.equal('pass');
      expect(config.port).to.equal('9821');
    });

    it('should work with no authentication options', function() {
      var sequelize = new Sequelize('mysql://example.com:9821/dbname');
      var config = sequelize.config;

      expect(config.username).to.not.be.ok;
      expect(config.password).to.be.null;
    });

    it('should work with no authentication options and passing additional options', function() {
      var sequelize = new Sequelize('mysql://example.com:9821/dbname', {});
      var config = sequelize.config;

      expect(config.username).to.not.be.ok;
      expect(config.password).to.be.null;
    });

    it('should use the default port when no other is specified', function() {
      var sequelize = new Sequelize('dbname', 'root', 'pass', {
          dialect: dialect
        })
        , config = sequelize.config
        , port;

      if (Support.dialectIsMySQL()) {
        port = 3306;
      } else if (dialect === 'postgres' || dialect === 'postgres-native') {
        port = 5432;
      } else {
        // sqlite has no concept of ports when connecting
        return;
      }

      expect(config.port).to.equal(port);
    });
  });

  describe('Intantiation with arguments', function() {
    it('should accept two parameters (database, username)', function() {
      var sequelize = new Sequelize('dbname', 'root');
      var config = sequelize.config;

      expect(config.database).to.equal('dbname');
      expect(config.username).to.equal('root');
    });

    it('should accept three parameters (database, username, password)', function() {
      var sequelize = new Sequelize('dbname', 'root', 'pass');
      var config = sequelize.config;

      expect(config.database).to.equal('dbname');
      expect(config.username).to.equal('root');
      expect(config.password).to.equal('pass');
    });

    it('should accept four parameters (database, username, password, options)', function() {
      var sequelize = new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialectOptions: {
          supportBigNumbers: true,
          bigNumberStrings: true
        }
      });
      var config = sequelize.config;

      expect(config.database).to.equal('dbname');
      expect(config.username).to.equal('root');
      expect(config.password).to.equal('pass');
      expect(config.port).to.equal(999);
      expect(config.dialectOptions.supportBigNumbers).to.be.true;
      expect(config.dialectOptions.bigNumberStrings).to.be.true;
    });
  });

});
