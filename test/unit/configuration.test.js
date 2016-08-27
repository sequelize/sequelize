'use strict';

/* jshint -W030 */
let chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , Sequelize = Support.Sequelize
  , dialect = Support.getTestDialect();

describe('Sequelize', function() {
  describe('dialect is required', function() {
    it('throw error when no dialect is supplied', function() {
      expect(function() {
        new Sequelize('localhost', 'test', 'test');
      }).to.throw(Error);
    });

    it('works when dialect explicitly supplied', function() {
      expect(function() {
        new Sequelize('localhost', 'test', 'test', {
          dialect: 'mysql'
        });
      }).not.to.throw(Error);
    });
  });

  it('should throw error if pool:false', function() {
    expect(function() {
      new Sequelize('localhost', 'test', 'test', {
        dialect: 'mysql',
        pool: false
      });
    }).to.throw('Support for pool:false was removed in v4.0');
  });

  describe('Instantiation with arguments', function() {
    it('should accept four parameters (database, username, password, options)', function() {
      const sequelize = new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialect,
        dialectOptions: {
          supportBigNumbers: true,
          bigNumberStrings: true
        }
      });
      const config = sequelize.config;

      expect(config.database).to.equal('dbname');
      expect(config.username).to.equal('root');
      expect(config.password).to.equal('pass');
      expect(config.port).to.equal(999);
      expect(sequelize.options.dialect).to.equal(dialect);
      expect(config.dialectOptions.supportBigNumbers).to.be.true;
      expect(config.dialectOptions.bigNumberStrings).to.be.true;
    });
  });

  describe('Instantiation with a URL string', function() {
    it('should accept username, password, host, port, and database', function() {
      const sequelize = new Sequelize('mysql://user:pass@example.com:9821/dbname');
      const config = sequelize.config;
      const options = sequelize.options;

      expect(options.dialect).to.equal('mysql');

      expect(config.database).to.equal('dbname');
      expect(config.host).to.equal('example.com');
      expect(config.username).to.equal('user');
      expect(config.password).to.equal('pass');
      expect(config.port).to.equal('9821');
    });

    it('should work with no authentication options', function() {
      const sequelize = new Sequelize('mysql://example.com:9821/dbname');
      const config = sequelize.config;

      expect(config.username).to.not.be.ok;
      expect(config.password).to.be.null;
    });

    it('should work with no authentication options and passing additional options', function() {
      const sequelize = new Sequelize('mysql://example.com:9821/dbname', {});
      const config = sequelize.config;

      expect(config.username).to.not.be.ok;
      expect(config.password).to.be.null;
    });

    it('should use the default port when no other is specified', function() {
      let sequelize = new Sequelize('dbname', 'root', 'pass', {
          dialect
        })
        , config = sequelize.config
        , port;

      if (dialect === 'mysql') {
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
});
