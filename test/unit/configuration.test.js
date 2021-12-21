'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect(),
  path = require('path');

describe('Sequelize', () => {
  describe('dialect is required', () => {
    it('throw error when no dialect is supplied', () => {
      expect(() => {
        new Sequelize('localhost', 'test', 'test');
      }).to.throw(Error);
    });

    it('works when dialect explicitly supplied', () => {
      expect(() => {
        new Sequelize('localhost', 'test', 'test', {
          dialect: 'mysql'
        });
      }).not.to.throw(Error);
    });
  });

  it('should throw error if pool:false', () => {
    expect(() => {
      new Sequelize('localhost', 'test', 'test', {
        dialect: 'mysql',
        pool: false
      });
    }).to.throw('Support for pool:false was removed in v4.0');
  });

  describe('Instantiation with arguments', () => {
    it('should accept four parameters (database, username, password, options)', () => {
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

  describe('Instantiation with a URL string', () => {
    it('should accept username, password, host, port, and database', () => {
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

    describe('sqllite path inititalization', () =>{
      const current   = Support.sequelize;
      if (current.dialect.name === 'sqlite') {
        it('should accept relative paths for sqlite', () => {
          const sequelize = new Sequelize('sqlite:subfolder/dbname.db');
          const options = sequelize.options;
          expect(options.dialect).to.equal('sqlite');
          expect(options.storage).to.equal(path.resolve('subfolder', 'dbname.db'));
        });

        it('should accept absolute paths for sqlite', () => {
          const sequelize = new Sequelize('sqlite:/home/abs/dbname.db');
          const options = sequelize.options;
          expect(options.dialect).to.equal('sqlite');
          expect(options.storage).to.equal(path.resolve('/home/abs/dbname.db'));
        });

        it('should prefer storage in options object', () => {
          const sequelize = new Sequelize('sqlite:/home/abs/dbname.db', { storage: '/completely/different/path.db' });
          const options = sequelize.options;
          expect(options.dialect).to.equal('sqlite');
          expect(options.storage).to.equal(path.resolve('/completely/different/path.db'));
        });

        it('should be able to use :memory:', () => {
          const sequelize = new Sequelize('sqlite://:memory:');
          const options = sequelize.options;
          expect(options.dialect).to.equal('sqlite');

          // empty host is treated as :memory:
          expect(options.host).to.equal('');
          expect(options.storage).to.equal(undefined);
        });
      }
    });

    it('should work with no authentication options', () => {
      const sequelize = new Sequelize('mysql://example.com:9821/dbname');
      const config = sequelize.config;

      expect(config.username).to.not.be.ok;
      expect(config.password).to.be.null;
    });

    it('should work with no authentication options and passing additional options', () => {
      const sequelize = new Sequelize('mysql://example.com:9821/dbname', {});
      const config = sequelize.config;

      expect(config.username).to.not.be.ok;
      expect(config.password).to.be.null;
    });

    it('should correctly set the username, the password and the database through options', () => {
      const options = {
        username: 'root',
        password: 'pass',
        database: 'dbname'
      };
      const sequelize = new Sequelize('mysql://example.com:9821', options);
      const config = sequelize.config;

      expect(config.username).to.equal(options.username);
      expect(config.password).to.equal(options.password);
      expect(config.database).to.equal(options.database);
    });

    it('should use the default port when no other is specified', () => {
      const sequelize = new Sequelize('dbname', 'root', 'pass', {
          dialect
        }),
        config = sequelize.config;
      let port;

      if (dialect === 'mysql') {
        port = 3306;
      } else if (['postgres', 'postgres-native'].includes(dialect)) {
        port = 5432;
      } else {
        // sqlite has no concept of ports when connecting
        return;
      }

      expect(config.port).to.equal(port);
    });

    it('should pass query string parameters to dialectOptions', () => {
      const sequelize = new Sequelize('mysql://example.com:9821/dbname?ssl=true');
      const dialectOptions = sequelize.config.dialectOptions;

      expect(dialectOptions.ssl).to.equal('true');
    });

    it('should merge query string parameters to options', () => {
      const sequelize = new Sequelize('mysql://example.com:9821/dbname?ssl=true&application_name=client', {
        storage: '/completely/different/path.db',
        dialectOptions: {
          supportBigNumbers: true,
          application_name: 'server' // eslint-disable-line
        }
      });

      const options = sequelize.options;
      const dialectOptions = sequelize.config.dialectOptions;

      expect(options.storage).to.equal('/completely/different/path.db');
      expect(dialectOptions.supportBigNumbers).to.be.true;
      expect(dialectOptions.application_name).to.equal('client');
      expect(dialectOptions.ssl).to.equal('true');
    });

    it('should handle JSON options', () => {
      const sequelizeWithOptions = new Sequelize('mysql://example.com:9821/dbname?options={"encrypt":true}&anotherOption=1');
      expect(sequelizeWithOptions.options.dialectOptions.options.encrypt).to.be.true;
      expect(sequelizeWithOptions.options.dialectOptions.anotherOption).to.equal('1');
    });

    it('should use query string host if specified', () => {
      const sequelize = new Sequelize('mysql://localhost:9821/dbname?host=example.com');

      const options = sequelize.options;
      expect(options.host).to.equal('example.com');
    });
  });
});
