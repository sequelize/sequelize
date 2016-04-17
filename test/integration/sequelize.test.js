'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , assert = chai.assert
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , dialect = Support.getTestDialect()
  , _ = require('lodash')
  , Sequelize = require(__dirname + '/../../index')
  , config = require(__dirname + '/../config/config')
  , moment = require('moment')
  , Transaction = require(__dirname + '/../../lib/transaction')
  , sinon = require('sinon')
  , babel = require('babel-core')
  , fs = require('fs')
  , current = Support.sequelize;


var qq = function(str) {
  if (dialect === 'postgres' || dialect === 'mssql') {
    return '"' + str + '"';
  } else if (Support.dialectIsMySQL() || dialect === 'sqlite') {
    return '`' + str + '`';
  } else {
    return str;
  }
};

describe(Support.getTestDialectTeaser('Sequelize'), function() {
  describe('constructor', function() {
    if (dialect !== 'sqlite') {
      it.skip('should work with minConnections', function() {
        var ConnectionManager = current.dialect.connectionManager
          , connectionSpy = ConnectionManager.connect = chai.spy(ConnectionManager.connect);

        Support.createSequelizeInstance({
          pool: {
            minConnections: 2
          }
        });
        expect(connectionSpy).to.have.been.called.twice;
      });
    }

    it('should pass the global options correctly', function() {
      var sequelize = Support.createSequelizeInstance({ logging: false, define: { underscored: true } })
        , DAO = sequelize.define('dao', {name: DataTypes.STRING});

      expect(DAO.options.underscored).to.be.ok;
    });

    it('should correctly set the host and the port', function() {
      var sequelize = Support.createSequelizeInstance({ host: '127.0.0.1', port: 1234 });
      expect(sequelize.config.port).to.equal(1234);
      expect(sequelize.config.host).to.equal('127.0.0.1');
    });

    if (dialect === 'sqlite') {
      it('should work with connection strings (1)', function() {
        var sequelize = new Sequelize('sqlite://test.sqlite'); // jshint ignore:line
      });
      it('should work with connection strings (2)', function() {
        var sequelize = new Sequelize('sqlite://test.sqlite/'); // jshint ignore:line
      });
      it('should work with connection strings (3)', function() {
        var sequelize = new Sequelize('sqlite://test.sqlite/lol?reconnect=true'); // jshint ignore:line
      });
    }

    if (dialect === 'postgres') {
      var getConnectionUri = _.template('<%= protocol %>://<%= username %>:<%= password %>@<%= host %><% if(port) { %>:<%= port %><% } %>/<%= database %>');
      it('should work with connection strings (postgres protocol)', function() {
        var connectionUri = getConnectionUri(_.extend(config[dialect], {protocol: 'postgres'}));
        // postgres://...
        var sequelize = new Sequelize(connectionUri); // jshint ignore:line
      });
      it('should work with connection strings (postgresql protocol)', function() {
        var connectionUri = getConnectionUri(_.extend(config[dialect], {protocol: 'postgresql'}));
        // postgresql://...
        var sequelize = new Sequelize(connectionUri); // jshint ignore:line
      });
    }
  });

  if (dialect !== 'sqlite') {
    describe('authenticate', function() {
      describe('with valid credentials', function() {
        it('triggers the success event', function() {
          return this.sequelize.authenticate();
        });
      });

      describe('with an invalid connection', function() {
        beforeEach(function() {
          var options = _.extend({}, this.sequelize.options, { port: '99999' });
          this.sequelizeWithInvalidConnection = new Sequelize('wat', 'trololo', 'wow', options);
        });

        it('triggers the error event', function() {
          return this
            .sequelizeWithInvalidConnection
            .authenticate()
            .catch(function(err) {
              expect(err).to.not.be.null;
            });
        });

        it('triggers an actual RangeError or ConnectionError', function() {
          return this
            .sequelizeWithInvalidConnection
            .authenticate()
            .catch(function(err) {
              expect(
                err instanceof RangeError ||
                err instanceof Sequelize.ConnectionError
              ).to.be.ok;
            });
        });

        it('triggers the actual adapter error', function() {
          return this
            .sequelizeWithInvalidConnection
            .authenticate()
            .catch(function(err) {
              expect(
                err.message.match(/connect ECONNREFUSED/) ||
                err.message.match(/invalid port number/) ||
                err.message.match(/Port should be > 0 and < 65536/) ||
                err.message.match(/port should be > 0 and < 65536/) ||
                err.message.match(/port should be >= 0 and < 65536: 99999/) ||
                err.message.match(/Login failed for user/)
              ).to.be.ok;
            });
        });
      });

      describe('with invalid credentials', function() {
        beforeEach(function() {
          this.sequelizeWithInvalidCredentials = new Sequelize('localhost', 'wtf', 'lol', this.sequelize.options);
        });

        it('triggers the error event', function() {
          return this
            .sequelizeWithInvalidCredentials
            .authenticate()
            .catch(function(err) {
              expect(err).to.not.be.null;
            });
        });

        it('triggers an actual sequlize error', function() {
          return this
            .sequelizeWithInvalidCredentials
            .authenticate()
            .catch(function(err) {
              expect(err).to.be.instanceof(Sequelize.Error);
            });
        });

        it('triggers the error event when using replication', function() {
          return new Sequelize('sequelize', null, null, {
            replication: {
              read: {
                host: 'localhost',
                username: 'omg',
                password: 'lol'
              }
            }
          }).authenticate()
            .catch(function(err) {
              expect(err).to.not.be.null;
            });
        });
      });
    });

    describe('validate', function() {
      it('is an alias for .authenticate()', function() {
        expect(this.sequelize.validate).to.equal(this.sequelize.authenticate);
      });
    });
  }

  describe('getDialect', function() {
    it('returns the defined dialect', function() {
      expect(this.sequelize.getDialect()).to.equal(dialect);
    });
  });

  describe('isDefined', function() {
    it('returns false if the dao wasn\'t defined before', function() {
      expect(this.sequelize.isDefined('Project')).to.be.false;
    });

    it('returns true if the dao was defined before', function() {
      this.sequelize.define('Project', {
        name: DataTypes.STRING
      });
      expect(this.sequelize.isDefined('Project')).to.be.true;
    });
  });

  describe('model', function() {
    it('throws an error if the dao being accessed is undefined', function() {
      var self = this;
      expect(function() {
        self.sequelize.model('Project');
      }).to.throw(/project has not been defined/i);
    });

    it('returns the dao factory defined by daoName', function() {
      var project = this.sequelize.define('Project', {
        name: DataTypes.STRING
      });

      expect(this.sequelize.model('Project')).to.equal(project);
    });
  });

  describe('query', function() {
    afterEach(function() {
      this.sequelize.options.quoteIdentifiers = true;

      console.log.restore && console.log.restore();
    });

    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        emailAddress: {
          type: DataTypes.STRING,
          field: 'email_address'
        }
      });

      this.insertQuery = 'INSERT INTO ' + qq(this.User.tableName) + ' (username, email_address, ' +
        qq('createdAt') + ', ' + qq('updatedAt') +
        ") VALUES ('john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10')";

      return this.User.sync({ force: true });
    });

    it('executes a query the internal way', function() {
      return this.sequelize.query(this.insertQuery, { raw: true });
    });

    it('executes a query if only the sql is passed', function() {
      return this.sequelize.query(this.insertQuery);
    });

    it('executes a query with global benchmarking option and default logger', function() {
      var logger = sinon.spy(console, 'log');
      var sequelize = Support.createSequelizeInstance({
        logging: logger,
        benchmark: true
      });

      return sequelize.query('select 1;').then(function() {
        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.match(/Executed \(default\): select 1; Elapsed time: \d+ms/);
      });
    });

    it('executes a query with global benchmarking option and custom logger', function() {
      var logger = sinon.spy();
      var sequelize = Support.createSequelizeInstance({
        logging: logger,
        benchmark: true
      });

      return sequelize.query('select 1;').then(function() {
        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.equal('Executed (default): select 1;');
        expect(typeof logger.args[0][1] === 'number').to.be.true;
      });
    });

    it('executes a query with benchmarking option and default logger', function() {
      var logger = sinon.spy(console, 'log');
      return this.sequelize.query('select 1;', {
        logging: logger,
        benchmark: true
      }).then(function() {
        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.match(/Executed \(default\): select 1; Elapsed time: \d+ms/);
      });
    });

    it('executes a query with benchmarking option and custom logger', function() {
      var logger = sinon.spy();

      return this.sequelize.query('select 1;', {
        logging: logger,
        benchmark: true
      }).then(function() {
        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.equal('Executed (default): select 1;');
        expect(typeof logger.args[0][1] === 'number').to.be.true;
      });
    });

    it('executes select queries correctly', function() {
      var self = this;
      return self.sequelize.query(this.insertQuery).then(function() {
        return self.sequelize.query('select * from ' + qq(self.User.tableName) + '');
      }).spread(function(users) {
        expect(users.map(function(u) { return u.username; })).to.include('john');
      });
    });

    it('executes select queries correctly when quoteIdentifiers is false', function() {
      var self = this
        , seq = Object.create(self.sequelize);

      seq.options.quoteIdentifiers = false;
      return seq.query(this.insertQuery).then(function() {
        return seq.query('select * from ' + qq(self.User.tableName) + '');
      }).spread(function(users) {
        expect(users.map(function(u) { return u.username; })).to.include('john');
      });
    });

    it('executes select query with dot notation results', function() {
      var self = this;
      return self.sequelize.query('DELETE FROM ' + qq(self.User.tableName)).then(function() {
        return self.sequelize.query(self.insertQuery);
      }).then(function() {
        return self.sequelize.query('select username as ' + qq('user.username') + ' from ' + qq(self.User.tableName) + '');
      }).spread(function( users) {
        expect(users).to.deep.equal([{'user.username': 'john'}]);
      });
    });

    it('executes select query with dot notation results and nest it', function() {
      var self = this;
      return self.sequelize.query('DELETE FROM ' + qq(self.User.tableName)).then(function() {
        return self.sequelize.query(self.insertQuery);
      }).then(function() {
        return self.sequelize.query('select username as ' + qq('user.username') + ' from ' + qq(self.User.tableName) + '', { raw: true, nest: true });
      }).then(function(users) {
        expect(users.map(function(u) { return u.user; })).to.deep.equal([{'username': 'john'}]);
      });
    });

    if (Support.dialectIsMySQL()) {
      it('executes stored procedures', function() {
        var self = this;
        return self.sequelize.query(this.insertQuery).then(function() {
          return self.sequelize.query('DROP PROCEDURE IF EXISTS foo').then(function() {
            return self.sequelize.query(
              'CREATE PROCEDURE foo()\nSELECT * FROM ' + self.User.tableName + ';'
            ).then(function() {
              return self.sequelize.query('CALL foo()').then(function(users) {
                expect(users.map(function(u) { return u.username; })).to.include('john');
              });
            });
          });
        });
      });
    } else {
      console.log('FIXME: I want to be supported in this dialect as well :-(');
    }

    it('uses the passed model', function() {
      return this.sequelize.query(this.insertQuery).bind(this).then(function() {
        return this.sequelize.query('SELECT * FROM ' + qq(this.User.tableName) + ';', {
          model: this.User
        });
      }).then(function(users) {
        expect(users[0].Model).to.equal(this.User);
      });
    });

    it('maps the field names to attributes based on the passed model', function() {
      return this.sequelize.query(this.insertQuery).bind(this).then(function() {
        return this.sequelize.query('SELECT * FROM ' + qq(this.User.tableName) + ';', {
          model: this.User,
          mapToModel: true
        });
      }).then(function(users) {
        expect(users[0].emailAddress).to.be.equal('john@gmail.com');
      });
    });

    it('arbitrarily map the field names', function() {
      return this.sequelize.query(this.insertQuery).bind(this).then(function() {
        return this.sequelize.query('SELECT * FROM ' + qq(this.User.tableName) + ';', {
          type: 'SELECT',
          fieldMap: {username: 'userName', email_address: 'email'}
        });
      }).then(function(users) {
        expect(users[0].userName).to.be.equal('john');
        expect(users[0].email).to.be.equal('john@gmail.com');
      });
    });

    it('throw an exception if `values` and `options.replacements` are both passed', function() {
      var self = this;
      expect(function() {
        return self.sequelize.query({ query: 'select ? as foo, ? as bar', values: [1, 2] }, { raw: true, replacements: [1, 2] });
      }).to.throw(Error, 'Both `sql.values` and `options.replacements` cannot be set at the same time');
    });

    it('throw an exception if `sql.bind` and `options.bind` are both passed', function() {
      var self = this;
      expect(function() {
        return self.sequelize.query({ query: 'select $1 + ? as foo, $2 + ? as bar', bind: [1, 2] }, { raw: true, bind: [1, 2] });
      }).to.throw(Error, 'Both `sql.bind` and `options.bind` cannot be set at the same time');
    });

    it('throw an exception if `options.replacements` and `options.bind` are both passed', function() {
      var self = this;
      expect(function() {
        return self.sequelize.query('select $1 + ? as foo, $2 + ? as bar', { raw: true, bind: [1, 2], replacements: [1, 2] });
      }).to.throw(Error, 'Both `replacements` and `bind` cannot be set at the same time');
    });

    it('throw an exception if `sql.bind` and `sql.values` are both passed', function() {
      var self = this;
      expect(function() {
        return self.sequelize.query({ query: 'select $1 + ? as foo, $2 + ? as bar', bind: [1, 2], values: [1, 2] }, { raw: true });
      }).to.throw(Error, 'Both `replacements` and `bind` cannot be set at the same time');
    });

    it('throw an exception if `sql.bind` and `options.replacements`` are both passed', function() {
      var self = this;
      expect(function() {
        return self.sequelize.query({ query: 'select $1 + ? as foo, $2 + ? as bar', bind: [1, 2] }, { raw: true, replacements: [1, 2] });
      }).to.throw(Error, 'Both `replacements` and `bind` cannot be set at the same time');
    });

    it('throw an exception if `options.bind` and `sql.replacements` are both passed', function() {
      var self = this;
      expect(function() {
        return self.sequelize.query({ query: 'select $1 + ? as foo, $1 _ ? as bar', values: [1, 2] }, { raw: true, bind: [1, 2] });
      }).to.throw(Error, 'Both `replacements` and `bind` cannot be set at the same time');
    });

    it('properly adds and escapes replacement value', function () {
      var logSql,
          number  = 1,
          date = new Date(),
          string = 't\'e"st',
          boolean = true,
          buffer = new Buffer('t\'e"st');

      date.setMilliseconds(0);
      return this.sequelize.query({
          query: 'select ? as number, ? as date,? as string,? as boolean,? as buffer',
          values: [number, date, string, boolean, buffer]
        }, {
          type: this.sequelize.QueryTypes.SELECT,
          logging: function(s) {
            logSql = s;
          }
        }).then(function(result) {
          var res = result[0] || {};
          res.date = res.date && new Date(res.date);
          res.boolean = res.boolean && true;
          if (typeof res.buffer === 'string' && res.buffer.indexOf('\\x') === 0) {
            res.buffer = new Buffer(res.buffer.substring(2), 'hex');
          }
          expect(res).to.deep.equal({
            number : number,
            date   : date,
            string : string,
            boolean: boolean,
            buffer : buffer
          });
          expect(logSql.indexOf('?')).to.equal(-1);
      });
    });

    it('uses properties `query` and `values` if query is tagged', function() {
      var logSql;
      return this.sequelize.query({ query: 'select ? as foo, ? as bar', values: [1, 2] }, { type: this.sequelize.QueryTypes.SELECT, logging: function(s) { logSql = s; } }).then(function(result) {
        expect(result).to.deep.equal([{ foo: 1, bar: 2 }]);
        expect(logSql.indexOf('?')).to.equal(-1);
      });
    });

    it('uses properties `query` and `bind` if query is tagged', function() {
      var typeCast = (dialect === 'postgres') ? '::int' : '';
      var logSql;
      return this.sequelize.query({ query: 'select $1'+typeCast+' as foo, $2'+typeCast+' as bar', bind: [1, 2] }, { type: this.sequelize.QueryTypes.SELECT, logging: function(s) { logSql = s; } }).then(function(result) {
        expect(result).to.deep.equal([{ foo: 1, bar: 2 }]);
        if ((dialect === 'postgres') || (dialect === 'sqlite')) {
          expect(logSql.indexOf('$1')).to.be.above(-1);
          expect(logSql.indexOf('$2')).to.be.above(-1);
        }
      });
    });

    it('dot separated attributes when doing a raw query without nest', function() {
      var tickChar = (dialect === 'postgres' || dialect === 'mssql') ? '"' : '`'
        , sql = 'select 1 as ' + Sequelize.Utils.addTicks('foo.bar.baz', tickChar);

      return expect(this.sequelize.query(sql, { raw: true, nest: false }).get(0)).to.eventually.deep.equal([{ 'foo.bar.baz': 1 }]);
    });

    it('destructs dot separated attributes when doing a raw query using nest', function() {
      var tickChar = (dialect === 'postgres' || dialect === 'mssql') ? '"' : '`'
        , sql = 'select 1 as ' + Sequelize.Utils.addTicks('foo.bar.baz', tickChar);

      return this.sequelize.query(sql, { raw: true, nest: true }).then(function(result) {
        expect(result).to.deep.equal([{ foo: { bar: { baz: 1 } } }]);
      });
    });

    it('replaces token with the passed array', function() {
      return this.sequelize.query('select ? as foo, ? as bar', { type: this.sequelize.QueryTypes.SELECT, replacements: [1, 2] }).then(function(result) {
        expect(result).to.deep.equal([{ foo: 1, bar: 2 }]);
      });
    });

    it('replaces named parameters with the passed object', function() {
      return expect(this.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: { one: 1, two: 2 }}).get(0))
        .to.eventually.deep.equal([{ foo: 1, bar: 2 }]);
    });

    it('replaces named parameters with the passed object and ignore those which does not qualify', function() {
      return expect(this.sequelize.query('select :one as foo, :two as bar, \'00:00\' as baz', { raw: true, replacements: { one: 1, two: 2 }}).get(0))
        .to.eventually.deep.equal([{ foo: 1, bar: 2, baz: '00:00' }]);
    });

    it('replaces named parameters with the passed object using the same key twice', function() {
      return expect(this.sequelize.query('select :one as foo, :two as bar, :one as baz', { raw: true, replacements: { one: 1, two: 2 }}).get(0))
        .to.eventually.deep.equal([{ foo: 1, bar: 2, baz: 1 }]);
    });

    it('replaces named parameters with the passed object having a null property', function() {
      return expect(this.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: { one: 1, two: null }}).get(0))
        .to.eventually.deep.equal([{ foo: 1, bar: null }]);
    });

    it('throw an exception when key is missing in the passed object', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar, :three as baz', { raw: true, replacements: { one: 1, two: 2 }});
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g);
    });

    it('throw an exception with the passed number', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: 2 });
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g);
    });

    it('throw an exception with the passed empty object', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: {}});
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g);
    });

    it('throw an exception with the passed string', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: 'foobar'});
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g);
    });

    it('throw an exception with the passed date', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: new Date()});
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g);
    });

    it('binds token with the passed array', function() {
      var typeCast = (dialect === 'postgres') ? '::int' : '';
      var logSql;
      return this.sequelize.query('select $1'+typeCast+' as foo, $2'+typeCast+' as bar', { type: this.sequelize.QueryTypes.SELECT, bind: [1, 2], logging: function(s) { logSql = s; } }).then(function(result) {
        expect(result).to.deep.equal([{ foo: 1, bar: 2 }]);
        if ((dialect === 'postgres') || (dialect === 'sqlite')) {
          expect(logSql.indexOf('$1')).to.be.above(-1);
        }
      });
    });

    it('binds named parameters with the passed object', function() {
      var typeCast = (dialect === 'postgres') ? '::int' : '';
      var logSql;
      return this.sequelize.query('select $one'+typeCast+' as foo, $two'+typeCast+' as bar', { raw: true, bind: { one: 1, two: 2 }, logging: function(s) { logSql = s; } }).then(function(result) {
        expect(result[0]).to.deep.equal([{ foo: 1, bar: 2 }]);
        if ((dialect === 'postgres')) {
          expect(logSql.indexOf('$1')).to.be.above(-1);
        }
        if ((dialect === 'sqlite')) {
          expect(logSql.indexOf('$one')).to.be.above(-1);
        }
      });
    });

    it('binds named parameters with the passed object using the same key twice', function() {
      var typeCast = (dialect === 'postgres') ? '::int' : '';
      var logSql;
      return this.sequelize.query('select $one'+typeCast+' as foo, $two'+typeCast+' as bar, $one'+typeCast+' as baz', { raw: true, bind: { one: 1, two: 2 }, logging: function(s) { logSql = s; } }).then(function(result) {
        expect(result[0]).to.deep.equal([{ foo: 1, bar: 2, baz: 1 }]);
        if ((dialect === 'postgres')) {
          expect(logSql.indexOf('$1')).to.be.above(-1);
          expect(logSql.indexOf('$2')).to.be.above(-1);
          expect(logSql.indexOf('$3')).to.equal(-1);
        }
      });
    });

    it('binds named parameters with the passed object having a null property', function() {
      var typeCast = (dialect === 'postgres') ? '::int' : '';
      var logSql;
      return this.sequelize.query('select $one'+typeCast+' as foo, $two'+typeCast+' as bar', { raw: true, bind: { one: 1, two: null }, logging: function(s) { logSql = s; } }).then(function(result) {
        expect(result[0]).to.deep.equal([{ foo: 1, bar: null }]);
      });
    });

    it('binds named parameters array handles escaped $$', function() {
      var typeCast = (dialect === 'postgres') ? '::int' : '';
      var logSql;
      return this.sequelize.query('select $1'+typeCast+' as foo, \'$$ / $$1\' as bar', { raw: true, bind: [1 ], logging: function(s) { logSql = s; } }).then(function(result) {
        expect(result[0]).to.deep.equal([{ foo: 1, bar: '$ / $1' }]);
        if ((dialect === 'postgres') || (dialect === 'sqlite')) {
          expect(logSql.indexOf('$1')).to.be.above(-1);
        }
      });
    });

    it('binds named parameters object handles escaped $$', function() {
      var typeCast = (dialect === 'postgres') ? '::int' : '';
      var logSql;
      return this.sequelize.query('select $one'+typeCast+' as foo, \'$$ / $$one\' as bar', { raw: true, bind: { one: 1 }, logging: function(s) { logSql = s; } }).then(function(result) {
        expect(result[0]).to.deep.equal([{ foo: 1, bar: '$ / $one' }]);
      });
    });

    if (dialect === 'postgres' || dialect === 'sqlite' || dialect === 'mssql') {
      it ('does not improperly escape arrays of strings bound to named parameters', function() {
        var logSql;
        return this.sequelize.query('select :stringArray as foo', { raw: true, replacements: { stringArray: [ '"string"' ] }, logging: function(s) { logSql = s; } }).then(function(result) {
          expect(result[0]).to.deep.equal([{ foo: '"string"' }]);
        });
      });
    }

    it('throw an exception when binds passed with object and numeric $1 is also present', function() {
      var self = this;
      var typeCast = (dialect === 'postgres') ? '::int' : '';
      var logSql;
      expect(function() {
        self.sequelize.query('select $one'+typeCast+' as foo, $two'+typeCast+' as bar, \'$1\' as baz', {  raw: true, bind: { one: 1, two: 2 }, logging: function(s) { logSql = s; } });
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('throw an exception when binds passed as array and $alpha is also present', function() {
      var self = this;
      var typeCast = (dialect === 'postgres') ? '::int' : '';
      var logSql;
      expect(function() {
        self.sequelize.query('select $1'+typeCast+' as foo, $2'+typeCast+' as bar, \'$foo\' as baz', { raw: true, bind: [1, 2], logging: function(s) { logSql = s; } });
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('throw an exception when bind key is $0 with the passed array', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select $1 as foo, $0 as bar, $3 as baz', { raw: true, bind: [1, 2] });
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('throw an exception when bind key is $01 with the passed array', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select $1 as foo, $01 as bar, $3 as baz', { raw: true, bind: [1, 2] });
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('throw an exception when bind key is missing in the passed array', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select $1 as foo, $2 as bar, $3 as baz', { raw: true, bind: [1, 2] });
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('throw an exception when bind key is missing in the passed object', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select $one as foo, $two as bar, $three as baz', { raw: true, bind: { one: 1, two: 2 }});
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('throw an exception with the passed number for bind', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select $one as foo, $two as bar', { raw: true, bind: 2 });
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('throw an exception with the passed empty object for bind', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select $one as foo, $two as bar', { raw: true, bind: {}});
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('throw an exception with the passed string for bind', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select $one as foo, $two as bar', { raw: true, bind: 'foobar'});
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('throw an exception with the passed date for bind', function() {
      var self = this;
      expect(function() {
        self.sequelize.query('select $one as foo, $two as bar', { raw: true, bind: new Date()});
      }).to.throw(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
    });

    it('handles AS in conjunction with functions just fine', function() {
      var datetime = (dialect === 'sqlite' ? 'date(\'now\')' : 'NOW()');
      if (dialect === 'mssql') {
        datetime = 'GETDATE()';
      }

      return this.sequelize.query('SELECT ' + datetime + ' AS t').spread(function(result) {
        expect(moment(result[0].t).isValid()).to.be.true;
      });
    });

    if (Support.getTestDialect() === 'postgres') {
      it('replaces named parameters with the passed object and ignores casts', function() {
        return expect(this.sequelize.query('select :one as foo, :two as bar, \'1000\'::integer as baz', { raw: true, replacements: { one: 1, two: 2 } }).get(0))
          .to.eventually.deep.equal([{ foo: 1, bar: 2, baz: 1000 }]);
      });

      it('supports WITH queries', function() {
        return expect(this.sequelize.query('WITH RECURSIVE t(n) AS ( VALUES (1) UNION ALL SELECT n+1 FROM t WHERE n < 100) SELECT sum(n) FROM t').get(0))
          .to.eventually.deep.equal([{ 'sum': '5050' }]);
      });
    }

    if (Support.getTestDialect() === 'sqlite') {
      it('binds array parameters for upsert are replaced. $$ unescapes only once', function() {
        var logSql;
        return this.sequelize.query('select $1 as foo, $2 as bar, \'$$$$\' as baz', { type: this.sequelize.QueryTypes.UPSERT, bind: [1, 2], logging: function(s) { logSql = s; } }).then(function(result) {
          // sqlite.exec does not return a result
          expect(logSql.indexOf('$one')).to.equal(-1);
          expect(logSql.indexOf('\'$$\'')).to.be.above(-1);
        });
      });

      it('binds named parameters for upsert are replaced. $$ unescapes only once', function() {
        var logSql;
        return this.sequelize.query('select $one as foo, $two as bar, \'$$$$\' as baz', { type: this.sequelize.QueryTypes.UPSERT, bind: { one: 1, two: 2 }, logging: function(s) { logSql = s; } }).then(function(result) {
          // sqlite.exec does not return a result
          expect(logSql.indexOf('$one')).to.equal(-1);
          expect(logSql.indexOf('\'$$\'')).to.be.above(-1);
        });
      });
    }

  });

  describe('set', function() {
    it("should be configurable with global functions", function() {
      var defaultClassMethod = sinon.spy()
        , overrideClassMethod = sinon.spy()
        , defaultInstanceMethod = sinon.spy()
        , overrideInstanceMethod = sinon.spy()
        , defaultSetterMethod = sinon.spy()
        , overrideSetterMethod = sinon.spy()
        , defaultGetterMethod = sinon.spy()
        , overrideGetterMethod = sinon.spy()
        , customClassMethod = sinon.spy()
        , customOverrideClassMethod = sinon.spy()
        , customInstanceMethod = sinon.spy()
        , customOverrideInstanceMethod = sinon.spy()
        , customSetterMethod = sinon.spy()
        , customOverrideSetterMethod = sinon.spy()
        , customGetterMethod = sinon.spy()
        , customOverrideGetterMethod = sinon.spy();

      this.sequelize.options.define = {
        'classMethods': {
          'defaultClassMethod': defaultClassMethod,
          'overrideClassMethod': overrideClassMethod
        },
        'instanceMethods': {
          'defaultInstanceMethod': defaultInstanceMethod,
          'overrideInstanceMethod': overrideInstanceMethod
        },
        'setterMethods': {
          'default': defaultSetterMethod,
          'override': overrideSetterMethod
        },
        'getterMethods': {
          'default': defaultGetterMethod,
          'override': overrideGetterMethod
        }
      };
      var testEntity = this.sequelize.define('TestEntity', {}, {
        'classMethods': {
          'customClassMethod': customClassMethod,
          'overrideClassMethod': customOverrideClassMethod
        },
        'instanceMethods': {
          'customInstanceMethod': customInstanceMethod,
          'overrideInstanceMethod': customOverrideInstanceMethod
        },
        'setterMethods': {
          'custom': customSetterMethod,
          'override': customOverrideSetterMethod
        },
        'getterMethods': {
          'custom': customGetterMethod,
          'override': customOverrideGetterMethod
        }
      });

      // Call all Class Methods
      testEntity.defaultClassMethod();
      testEntity.customClassMethod();
      testEntity.overrideClassMethod();

      expect(typeof testEntity.defaultClassMethod).to.equal('function');
      expect(typeof testEntity.customClassMethod).to.equal('function');
      expect(typeof testEntity.overrideClassMethod).to.equal('function');

      expect(defaultClassMethod).to.have.been.calledOnce;
      expect(customClassMethod).to.have.been.calledOnce;
      expect(overrideClassMethod.callCount).to.be.eql(0);
      expect(customOverrideClassMethod).to.have.been.calledOnce;

      // Create Instance to test
      var instance = testEntity.build();

      // Call all Instance Methods
      instance.defaultInstanceMethod();
      instance.customInstanceMethod();
      instance.overrideInstanceMethod();

      expect(typeof instance.defaultInstanceMethod).to.equal('function');
      expect(typeof instance.customInstanceMethod).to.equal('function');
      expect(typeof instance.overrideInstanceMethod).to.equal('function');

      expect(defaultInstanceMethod).to.have.been.calledOnce;
      expect(customInstanceMethod).to.have.been.calledOnce;
      expect(overrideInstanceMethod.callCount).to.be.eql(0);
      expect(customOverrideInstanceMethod).to.have.been.calledOnce;

      // Call Getters
      instance.default;
      instance.custom;
      instance.override;

      expect(defaultGetterMethod).to.have.been.calledOnce;
      expect(customGetterMethod).to.have.been.calledOnce;
      expect(overrideGetterMethod.callCount).to.be.eql(0);
      expect(customOverrideGetterMethod).to.have.been.calledOnce;

      // Call Setters
      instance.default = 'test';
      instance.custom = 'test';
      instance.override = 'test';

      expect(defaultSetterMethod).to.have.been.calledOnce;
      expect(customSetterMethod).to.have.been.calledOnce;
      expect(overrideSetterMethod.callCount).to.be.eql(0);
      expect(customOverrideSetterMethod).to.have.been.calledOnce;
    });
  });

  if (Support.dialectIsMySQL()) {
    describe('set', function() {
      it("should return an promised error if transaction isn't defined", function() {
        expect(function() {
          this.sequelize.set({ foo: 'bar' });
        }.bind(this)).to.throw(TypeError, 'options.transaction is required');
      });

      it('one value', function() {
        return this.sequelize.transaction().bind(this).then(function(t) {
          this.t = t;
          return this.sequelize.set({ foo: 'bar' }, { transaction: t });
        }).then(function() {
          return this.sequelize.query('SELECT @foo as `foo`', { plain: true, transaction: this.t });
        }).then(function(data) {
          expect(data).to.be.ok;
          expect(data.foo).to.be.equal('bar');
          return this.t.commit();
        });
      });

      it('multiple values', function() {
        return this.sequelize.transaction().bind(this).then(function(t) {
          this.t = t;
          return this.sequelize.set({
            foo: 'bar',
            foos: 'bars'
          }, { transaction: t });
        }).then(function() {
          return this.sequelize.query('SELECT @foo as `foo`, @foos as `foos`', { plain: true, transaction: this.t });
        }).then(function(data) {
          expect(data).to.be.ok;
          expect(data.foo).to.be.equal('bar');
          expect(data.foos).to.be.equal('bars');
          return this.t.commit();
        });
      });
    });
  }

  describe('define', function() {
    it('adds a new dao to the dao manager', function() {
      var count = this.sequelize.modelManager.all.length;
      this.sequelize.define('foo', { title: DataTypes.STRING });
      expect(this.sequelize.modelManager.all.length).to.equal(count+1);
    });

    it('adds a new dao to sequelize.models', function() {
      expect(this.sequelize.models.bar).to.equal(undefined);
      var Bar = this.sequelize.define('bar', { title: DataTypes.STRING });
      expect(this.sequelize.models.bar).to.equal(Bar);
    });

    it('overwrites global options', function() {
      var sequelize = Support.createSequelizeInstance({ define: { collate: 'utf8_general_ci' } });
      var DAO = sequelize.define('foo', {bar: DataTypes.STRING}, {collate: 'utf8_bin'});
      expect(DAO.options.collate).to.equal('utf8_bin');
    });

    it('inherits global collate option', function() {
      var sequelize = Support.createSequelizeInstance({ define: { collate: 'utf8_general_ci' } });
      var DAO = sequelize.define('foo', {bar: DataTypes.STRING});
      expect(DAO.options.collate).to.equal('utf8_general_ci');
    });

    it('inherits global classMethods and instanceMethods, and can override global methods with local ones', function() {
      var globalClassMethod = sinon.spy()
        , globalInstanceMethod = sinon.spy()
        , localClassMethod = sinon.spy()
        , localInstanceMethod = sinon.spy()
        , sequelize = Support.createSequelizeInstance({
          define: {
            classMethods: {
              globalClassMethod: function() {},
              overrideMe: globalClassMethod
            },
            instanceMethods: {
              globalInstanceMethod: function() {},
              overrideMe: globalInstanceMethod
            }
          }
        })
        , DAO;

      DAO = sequelize.define('foo', {bar: DataTypes.STRING}, {
        classMethods: { localClassMethod: function() {} }
      });

      expect(typeof DAO.options.classMethods.globalClassMethod).to.equal('function');
      expect(typeof DAO.options.classMethods.localClassMethod).to.equal('function');
      expect(typeof DAO.options.instanceMethods.globalInstanceMethod).to.equal('function');

      // This DAO inherits the global methods
      DAO.overrideMe();
      DAO.build().overrideMe();

      DAO = sequelize.define('foo', {bar: DataTypes.STRING}, {
        classMethods: {
          overrideMe: localClassMethod
        },
        instanceMethods: {
          overrideMe: localInstanceMethod
        }
      });

      // This DAO has its own implementation
      DAO.overrideMe();
      DAO.build().overrideMe();

      expect(globalClassMethod).to.have.been.calledOnce;
      expect(globalInstanceMethod).to.have.been.calledOnce;

      expect(localClassMethod).to.have.been.calledOnce;
      expect(localInstanceMethod).to.have.been.calledOnce;

    });

    it('uses the passed tableName', function() {
      var self = this
        , Photo = this.sequelize.define('Foto', { name: DataTypes.STRING }, { tableName: 'photos' });
      return Photo.sync({ force: true }).then(function() {
        return self.sequelize.getQueryInterface().showAllTables().then(function(tableNames) {
          if (dialect === 'mssql' /* current.dialect.supports.schemas */) {
            tableNames = _.map(tableNames, 'tableName');
          }
          expect(tableNames).to.include('photos');
        });
      });
    });
  });

  describe('truncate', function() {
    it("truncates all models", function() {
      var Project = this.sequelize.define('project' + config.rand(), {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            title: DataTypes.STRING
          });

      return this.sequelize.sync({ force: true }).then(function() {
        return Project.create({ title: 'bla' });
      }).bind(this).then(function(project) {
        expect(project).to.exist;
        expect(project.title).to.equal('bla');
        expect(project.id).to.equal(1);
        return this.sequelize.truncate().then(function() {
          return Project.findAll({});
        });
      }).then(function(projects) {
        expect(projects).to.exist;
        expect(projects).to.have.length(0);
      });
    });
  });

  describe('sync', function() {
    it('synchronizes all models', function() {
      var Project = this.sequelize.define('project' + config.rand(), { title: DataTypes.STRING });
      var Task = this.sequelize.define('task' + config.rand(), { title: DataTypes.STRING });

      return Project.sync({ force: true }).then(function() {
        return Task.sync({ force: true }).then(function() {
          return Project.create({title: 'bla'}).then(function() {
            return Task.create({title: 'bla'}).then(function(task) {
              expect(task).to.exist;
              expect(task.title).to.equal('bla');
            });
          });
        });
      });
    });

    it('works with correct database credentials', function() {
      var User = this.sequelize.define('User', { username: DataTypes.STRING });
      return User.sync().then(function() {
        expect(true).to.be.true;
      });
    });

    if (dialect !== 'sqlite') {
      it('fails with incorrect database credentials (1)', function() {
        this.sequelizeWithInvalidCredentials = new Sequelize('omg', 'bar', null, _.omit(this.sequelize.options, ['host']));

        var User2 = this.sequelizeWithInvalidCredentials.define('User', { name: DataTypes.STRING, bio: DataTypes.TEXT });

        return User2.sync().catch(function(err) {
          if (dialect === 'postgres' || dialect === 'postgres-native') {
            assert([
              'fe_sendauth: no password supplied',
              'role "bar" does not exist',
              'FATAL:  role "bar" does not exist',
              'password authentication failed for user "bar"'
            ].indexOf(err.message.trim()) !== -1);
          } else if (dialect === 'mssql') {
            expect(err.message).to.match(/.*ECONNREFUSED.*/);
          } else {
            expect(err.message.toString()).to.match(/.*Access\ denied.*/);
          }
        });
      });

      it('fails with incorrect database credentials (2)', function() {
        var sequelize = new Sequelize('db', 'user', 'pass', {
          dialect: this.sequelize.options.dialect
        });

        sequelize.define('Project', {title: Sequelize.STRING});
        sequelize.define('Task', {title: Sequelize.STRING});

        return sequelize.sync({force: true}).catch(function(err) {
          expect(err).to.be.ok;
        });
      });

      it('fails with incorrect database credentials (3)', function() {
        var sequelize = new Sequelize('db', 'user', 'pass', {
          dialect: this.sequelize.options.dialect,
          port: 99999
        });

        sequelize.define('Project', {title: Sequelize.STRING});
        sequelize.define('Task', {title: Sequelize.STRING});

        return sequelize.sync({force: true}).catch(function(err) {
          expect(err).to.be.ok;
        });
      });

      it('fails with incorrect database credentials (4)', function() {
        var sequelize = new Sequelize('db', 'user', 'pass', {
          dialect: this.sequelize.options.dialect,
          port: 99999,
          pool: {}
        });

        sequelize.define('Project', {title: Sequelize.STRING});
        sequelize.define('Task', {title: Sequelize.STRING});

        return sequelize.sync({force: true}).catch(function(err) {
          expect(err).to.be.ok;
        });
      });

      it('returns an error correctly if unable to sync a foreign key referenced model', function() {
        this.sequelize.define('Application', {
          authorID: { type: Sequelize.BIGINT, allowNull: false, references: { model: 'User', key: 'id' } }
        });

        return this.sequelize.sync().catch(function(error) {
          assert.ok(error);
        });
      });

      it('handles self dependant foreign key constraints', function() {
        var block = this.sequelize.define('block', {
          id: { type: DataTypes.INTEGER, primaryKey: true },
          name: DataTypes.STRING
        }, {
          tableName: 'block',
          timestamps: false,
          paranoid: false
        });

        block.hasMany(block, {
          as: 'childBlocks',
          foreignKey: 'parent',
          joinTableName: 'link_block_block',
          useJunctionTable: true,
          foreignKeyConstraint: true
        });
        block.belongsTo(block, {
          as: 'parentBlocks',
          foreignKey: 'child',
          joinTableName: 'link_block_block',
          useJunctionTable: true,
          foreignKeyConstraint: true
        });

        return this.sequelize.sync();
      });

      it('return the sequelize instance after syncing', function() {
        var self = this;
        return this.sequelize.sync().then(function(sequelize) {
          expect(sequelize).to.deep.equal(self.sequelize);
        });
      });

      it('return the single dao after syncing', function() {
        var block = this.sequelize.define('block', {
          id: { type: DataTypes.INTEGER, primaryKey: true },
          name: DataTypes.STRING
        }, {
          tableName: 'block',
          timestamps: false,
          paranoid: false
        });

        return block.sync().then(function(result) {
          expect(result).to.deep.equal(block);
        });
      });
    }

    describe("doesn't emit logging when explicitly saying not to", function() {
      afterEach(function() {
        this.sequelize.options.logging = false;
      });

      beforeEach(function() {
        this.spy = sinon.spy();
        var self = this;
        this.sequelize.options.logging = function() { self.spy(); };
        this.User = this.sequelize.define('UserTest', { username: DataTypes.STRING });
      });

      it('through Sequelize.sync()', function() {
        var self = this;
        return this.sequelize.sync({ force: true, logging: false }).then(function() {
          expect(self.spy.notCalled).to.be.true;
        });
      });

      it('through DAOFactory.sync()', function() {
        var self = this;
        return this.User.sync({ force: true, logging: false }).then(function() {
          expect(self.spy.notCalled).to.be.true;
        });
      });
    });

    describe('match', function() {
      it('will return an error not matching', function() {
        expect(
          this.sequelize.sync({
            force: true,
            match: /alibabaizshaek/
          })
        ).to.be.rejected;
      });
    });
  });

  describe('drop should work', function() {
    it('correctly succeeds', function() {
      var User = this.sequelize.define('Users', {username: DataTypes.STRING });
      return User.sync({ force: true }).then(function() {
        return User.drop();
      });
    });
  });

  describe('import', function() {
    it('imports a dao definition from a file absolute path', function() {
      var Project = this.sequelize.import(__dirname + '/assets/project');
      expect(Project).to.exist;
    });

    it('imports a dao definition from a file compiled with babel', function () {
      var es6project = babel.transformFileSync(__dirname + '/assets/es6project.es6', {
        presets: ['es2015']
      }).code;
      fs.writeFileSync(__dirname + '/assets/es6project.js', es6project);
      var Project = this.sequelize.import(__dirname + '/assets/es6project');
      expect(Project).to.exist;

    });

    after(function(){
      fs.unlink(__dirname + '/assets/es6project.js');
    });

    it('imports a dao definition from a function', function() {
      var Project = this.sequelize.import('Project', function(sequelize, DataTypes) {
        return sequelize.define('Project' + parseInt(Math.random() * 9999999999999999), {
          name: DataTypes.STRING
        });
      });

      expect(Project).to.exist;
    });
  });

  describe('define', function() {
    [
      { type: DataTypes.ENUM, values: ['scheduled', 'active', 'finished']},
      DataTypes.ENUM('scheduled', 'active', 'finished')
    ].forEach(function(status) {
      describe('enum', function() {
        beforeEach(function() {
          this.sequelize = Support.createSequelizeInstance({
            typeValidation: true
          });

          this.Review = this.sequelize.define('review', { status: status });
          return this.Review.sync({ force: true });
        });

        it('raises an error if no values are defined', function() {
          var self = this;
          expect(function() {
            self.sequelize.define('omnomnom', {
              bla: { type: DataTypes.ENUM }
            });
          }).to.throw(Error, 'Values for ENUM have not been defined.');
        });

        it('correctly stores values', function() {
          return this.Review.create({ status: 'active' }).then(function(review) {
            expect(review.status).to.equal('active');
          });
        });

        it('correctly loads values', function() {
          var self = this;
          return this.Review.create({ status: 'active' }).then(function() {
            return self.Review.findAll().then(function(reviews) {
              expect(reviews[0].status).to.equal('active');
            });
          });
        });

        it("doesn't save an instance if value is not in the range of enums", function() {
          return this.Review.create({status: 'fnord'}).catch(function(err) {
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.equal('"fnord" is not a valid choice in ["scheduled","active","finished"]');
          });
        });
      });
    });

    describe('table', function() {
      [
        { id: { type: DataTypes.BIGINT, primaryKey: true } },
        { id: { type: DataTypes.STRING, allowNull: true, primaryKey: true } },
        { id: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true } }
      ].forEach(function(customAttributes) {

        it('should be able to override options on the default attributes', function() {
          var Picture = this.sequelize.define('picture', _.cloneDeep(customAttributes));
          return Picture.sync({ force: true }).then(function() {
            Object.keys(customAttributes).forEach(function(attribute) {
              Object.keys(customAttributes[attribute]).forEach(function(option) {
                var optionValue = customAttributes[attribute][option];
                if (typeof optionValue === "function" && optionValue() instanceof DataTypes.ABSTRACT) {
                  expect(Picture.rawAttributes[attribute][option] instanceof optionValue).to.be.ok;
                } else {
                  expect(Picture.rawAttributes[attribute][option]).to.be.equal(optionValue);
                }
              });
            });
          });
        });

      });
    });

    if (current.dialect.supports.transactions) {
      describe('transaction', function() {
        beforeEach(function() {
          var self = this;

          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            self.sequelizeWithTransaction = sequelize;
          });
        });

        it('is a transaction method available', function() {
          expect(Support.Sequelize).to.respondTo('transaction');
        });

        it('passes a transaction object to the callback', function() {
          return this.sequelizeWithTransaction.transaction().then(function(t) {
            expect(t).to.be.instanceOf(Transaction);
          });
        });

        it('allows me to define a callback on the result', function() {
          return this.sequelizeWithTransaction.transaction().then(function(t) {
            return t.commit();
          });
        });

        if (dialect === 'sqlite') {
          it('correctly scopes transaction from other connections', function() {
            var TransactionTest = this.sequelizeWithTransaction.define('TransactionTest', { name: DataTypes.STRING }, { timestamps: false })
              , self = this;

            var count = function(transaction) {
              var sql = self.sequelizeWithTransaction.getQueryInterface().QueryGenerator.selectQuery('TransactionTests', { attributes: [['count(*)', 'cnt']] });

              return self.sequelizeWithTransaction.query(sql, { plain: true, transaction: transaction }).then(function(result) {
                return result.cnt;
              });
            };

            return TransactionTest.sync({ force: true }).bind(this).then(function() {
              return self.sequelizeWithTransaction.transaction();
            }).then(function(t1) {
              this.t1 = t1;
              return self.sequelizeWithTransaction.query('INSERT INTO ' + qq('TransactionTests') + ' (' + qq('name') + ') VALUES (\'foo\');', { transaction: t1 });
            }).then(function() {
              return expect(count()).to.eventually.equal(0);
            }).then(function() {
              return expect(count(this.t1)).to.eventually.equal(1);
            }).then(function () {
              return this.t1.commit();
            }).then(function() {
              return expect(count()).to.eventually.equal(1);
            });
          });
        } else {
          it('correctly handles multiple transactions', function() {
            var TransactionTest = this.sequelizeWithTransaction.define('TransactionTest', { name: DataTypes.STRING }, { timestamps: false })
              , self = this;

            var count = function(transaction) {
              var sql = self.sequelizeWithTransaction.getQueryInterface().QueryGenerator.selectQuery('TransactionTests', { attributes: [['count(*)', 'cnt']] });

              return self.sequelizeWithTransaction.query(sql, { plain: true, transaction: transaction }).then(function(result) {
                return parseInt(result.cnt, 10);
              });
            };

            return TransactionTest.sync({ force: true }).bind(this).then(function() {
              return self.sequelizeWithTransaction.transaction();
            }).then(function(t1) {
              this.t1 = t1;
              return self.sequelizeWithTransaction.query('INSERT INTO ' + qq('TransactionTests') + ' (' + qq('name') + ') VALUES (\'foo\');', { transaction: t1 });
            }).then(function() {
              return self.sequelizeWithTransaction.transaction();
            }).then(function(t2) {
              this.t2 = t2;
              return self.sequelizeWithTransaction.query('INSERT INTO ' + qq('TransactionTests') + ' (' + qq('name') + ') VALUES (\'bar\');', { transaction: t2 });
            }).then(function() {
              return expect(count()).to.eventually.equal(0);
            }).then(function() {
              return expect(count(this.t1)).to.eventually.equal(1);
            }).then(function() {
              return expect(count(this.t2)).to.eventually.equal(1);
            }).then(function() {

              return this.t2.rollback();
            }).then(function() {
              return expect(count()).to.eventually.equal(0);
            }).then(function() {
              return this.t1.commit();
            }).then(function() {
              return expect(count()).to.eventually.equal(1);
            });
          });
        }

        it('supports nested transactions using savepoints', function() {
          var self = this;
          var User = this.sequelizeWithTransaction.define('Users', { username: DataTypes.STRING });

          return User.sync({ force: true }).then(function() {
            return self.sequelizeWithTransaction.transaction().then(function(t1) {
              return User.create({ username: 'foo' }, { transaction: t1 }).then(function(user) {
                return self.sequelizeWithTransaction.transaction({ transaction: t1 }).then(function(t2) {
                  return user.updateAttributes({ username: 'bar' }, { transaction: t2 }).then(function() {
                    return t2.commit().then(function() {
                      return user.reload({ transaction: t1 }).then(function(newUser) {
                        expect(newUser.username).to.equal('bar');
                        return t1.commit();
                      });
                    });
                  });
                });
              });
            });
          });
        });

        describe('supports rolling back to savepoints', function() {
          beforeEach(function() {
            this.User = this.sequelizeWithTransaction.define('user', {});
            return this.sequelizeWithTransaction.sync({ force: true });
          });

          it('rolls back to the first savepoint, undoing everything', function() {
            return this.sequelizeWithTransaction.transaction().bind(this).then(function(transaction) {
              this.transaction = transaction;

              return this.sequelizeWithTransaction.transaction({ transaction: transaction });
            }).then(function(sp1) {
              this.sp1 = sp1;
              return this.User.create({}, { transaction: this.transaction });
            }).then(function() {
              return this.sequelizeWithTransaction.transaction({ transaction: this.transaction });
            }).then(function(sp2) {
              this.sp2 = sp2;
              return this.User.create({}, { transaction: this.transaction });
            }).then(function() {
              return this.User.findAll({ transaction: this.transaction });
            }).then(function(users) {
              expect(users).to.have.length(2);

              return this.sp1.rollback();
            }).then(function() {
              return this.User.findAll({ transaction: this.transaction });
            }).then(function(users) {
              expect(users).to.have.length(0);

              return this.transaction.rollback();
            });
          });

          it('rolls back to the most recent savepoint, only undoing recent changes', function() {
            return this.sequelizeWithTransaction.transaction().bind(this).then(function(transaction) {
              this.transaction = transaction;

              return this.sequelizeWithTransaction.transaction({ transaction: transaction });
            }).then(function(sp1) {
              this.sp1 = sp1;
              return this.User.create({}, { transaction: this.transaction });
            }).then(function() {
              return this.sequelizeWithTransaction.transaction({ transaction: this.transaction });
            }).then(function(sp2) {
              this.sp2 = sp2;
              return this.User.create({}, { transaction: this.transaction });
            }).then(function() {
              return this.User.findAll({ transaction: this.transaction });
            }).then(function(users) {
              expect(users).to.have.length(2);

              return this.sp2.rollback();
            }).then(function() {
              return this.User.findAll({ transaction: this.transaction });
            }).then(function(users) {
              expect(users).to.have.length(1);

              return this.transaction.rollback();
            });
          });
        });

        it('supports rolling back a nested transaction', function() {
          var self = this;
          var User = this.sequelizeWithTransaction.define('Users', { username: DataTypes.STRING });

          return User.sync({ force: true }).then(function() {
            return self.sequelizeWithTransaction.transaction().then(function(t1) {
              return User.create({ username: 'foo' }, { transaction: t1 }).then(function(user) {
                return self.sequelizeWithTransaction.transaction({ transaction: t1 }).then(function(t2) {
                  return user.updateAttributes({ username: 'bar' }, { transaction: t2 }).then(function() {
                    return t2.rollback().then(function() {
                      return user.reload({ transaction: t1 }).then(function(newUser) {
                        expect(newUser.username).to.equal('foo');
                        return t1.commit();
                      });
                    });
                  });
                });
              });
            });
          });
        });

        it('supports rolling back outermost transaction', function() {
          var self = this;
          var User = this.sequelizeWithTransaction.define('Users', { username: DataTypes.STRING });

          return User.sync({ force: true }).then(function() {
            return self.sequelizeWithTransaction.transaction().then(function(t1) {
              return User.create({ username: 'foo' }, { transaction: t1 }).then(function(user) {
                return self.sequelizeWithTransaction.transaction({ transaction: t1 }).then(function(t2) {
                  return user.updateAttributes({ username: 'bar' }, { transaction: t2 }).then(function() {
                    return t1.rollback().then(function() {
                      return User.findAll().then(function(users) {
                        expect(users.length).to.equal(0);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    }
  });

  describe('databaseVersion', function() {
    it('should database/dialect version', function() {
      return this.sequelize.databaseVersion().then(function(version) {
        expect(typeof version).to.equal('string');
        expect(version).to.be.ok;
      });
    });
  });

  describe('paranoid deletedAt non-null default value', function() {
    it('should use defaultValue of deletedAt in paranoid clause and restore', function() {
      var epochObj = new Date(0)
        , epoch = Number(epochObj);
      var User = this.sequelize.define('user', {
        username: DataTypes.STRING,
        deletedAt: {
          type: DataTypes.DATE,
          defaultValue: epochObj
        }
      }, {
        paranoid: true,
      });

      return this.sequelize.sync({force: true}).bind(this).then(function () {
        return User.create({username: 'user1'}).then(function(user) {
          expect(Number(user.deletedAt)).to.equal(epoch);
          return User.findOne({
            where: {
              username: 'user1'
            }
          }).then(function (user) {
            expect(user).to.exist;
            expect(Number(user.deletedAt)).to.equal(epoch);
            return user.destroy();
          }).then(function(destroyedUser) {
            expect(destroyedUser.deletedAt).to.exist;
            expect(Number(destroyedUser.deletedAt)).not.to.equal(epoch);
            return User.findById(destroyedUser.id, { paranoid: false });
          }).then(function(fetchedDestroyedUser) {
            expect(fetchedDestroyedUser.deletedAt).to.exist;
            expect(Number(fetchedDestroyedUser.deletedAt)).not.to.equal(epoch);
            return fetchedDestroyedUser.restore();
          }).then(function(restoredUser) {
            expect(Number(restoredUser.deletedAt)).to.equal(epoch);
            return User.destroy({where: {
              username: 'user1'
            }});
          }).then(function() {
            return User.count();
          }).then(function(count) {
            expect(count).to.equal(0);
            return User.restore();
          }).then(function() {
            return User.findAll();
          }).then(function(nonDeletedUsers) {
            expect(nonDeletedUsers.length).to.equal(1);
            nonDeletedUsers.forEach(function(u) {
              expect(Number(u.deletedAt)).to.equal(epoch);
            });
          });
        });
      });
    });
  });
});
