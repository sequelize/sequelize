'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , config = require(__dirname + '/../config/config')
  , Support = require(__dirname + '/support')
  , dialect = Support.getTestDialect()
  , Sequelize = Support.Sequelize
  , fs = require('fs')
  , path = require('path');

describe(Support.getTestDialectTeaser('Configuration'), function() {
  describe('Connections problems should fail with a nice message', function() {
    it('when we don\'t have the correct server details', function() {
      if (dialect === 'mariadb') {
        console.log('This dialect doesn\'t support me :(');
        expect(true).to.be.true; // Silence Buster
        return;
      }

      var seq = new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {storage: '/path/to/no/where/land', logging: false, host: '0.0.0.1', port: config[dialect].port, dialect: dialect});
      if (dialect === 'sqlite') {
        // SQLite doesn't have a breakdown of error codes, so we are unable to discern between the different types of errors.
        return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(seq.ConnectionError, 'SQLITE_CANTOPEN: unable to open database file');
      } else {
        return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith([seq.HostNotReachableError, seq.InvalidConnectionError]);
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
      }).to.throw(Error, 'The dialect undefined is not supported. Supported dialects: mariadb, mssql, mysql, postgres, and sqlite.');
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

  describe('Instantiation with arguments', function() {
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

    if (dialect === 'sqlite') {
      var sqlite3 = require('sqlite3');
      it('should respect READONLY / READWRITE connection modes', function() {
        var p = path.join(__dirname, '../tmp', 'foo.sqlite');
        var createTableFoo = 'CREATE TABLE foo (faz TEXT);';
        var createTableBar = 'CREATE TABLE bar (baz TEXT);';

        var testAccess = Sequelize.Promise.method(function() {
          if (fs.access) {
            return Sequelize.Promise.promisify(fs.access)(p, fs.R_OK | fs.W_OK);
          } else { // Node v0.10 and older don't have fs.access
            return Sequelize.Promise.promisify(fs.open)(p, 'r+')
            .then(function(fd) {
              return Sequelize.Promise.promisify(fs.close)(fd);
            });
          }
        });

        return Sequelize.Promise.promisify(fs.unlink)(p)
        .catch(function(err) {
          expect(err.code).to.equal('ENOENT');
        })
        .then(function() {
          var sequelizeReadOnly = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READONLY
            }
          });
          var sequelizeReadWrite = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READWRITE
            }
          });

          expect(sequelizeReadOnly.config.dialectOptions.mode).to.equal(sqlite3.OPEN_READONLY);
          expect(sequelizeReadWrite.config.dialectOptions.mode).to.equal(sqlite3.OPEN_READWRITE);

          return Sequelize.Promise.join(
            sequelizeReadOnly.query(createTableFoo)
              .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file'),
            sequelizeReadWrite.query(createTableFoo)
              .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file')
          );
        })
        .then(function() {
          // By default, sqlite creates a connection that's READWRITE | CREATE
          var sequelize = new Sequelize('sqlite://foo', {
            storage: p
          });
          return sequelize.query(createTableFoo);
        })
        .then(testAccess)
        .then(function() {
          var sequelizeReadOnly = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READONLY
            }
          });
          var sequelizeReadWrite = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READWRITE
            }
          });

          return Sequelize.Promise.join(
            sequelizeReadOnly.query(createTableBar)
              .should.be.rejectedWith(Error, 'SQLITE_READONLY: attempt to write a readonly database'),
            sequelizeReadWrite.query(createTableBar)
          );
        })
        .finally(function() {
          return Sequelize.Promise.promisify(fs.unlink)(p);
        });
      });
    }
  });

});
