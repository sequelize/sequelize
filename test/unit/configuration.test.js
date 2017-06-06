'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect();

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
          expect(options.storage).to.equal('subfolder/dbname.db');
        });

        it('should accept absolute paths for sqlite', () => {
          const sequelize = new Sequelize('sqlite:/home/abs/dbname.db');
          const options = sequelize.options;
          expect(options.dialect).to.equal('sqlite');
          expect(options.storage).to.equal('/home/abs/dbname.db');
        });

        it('should prefer storage in options object', () => {
          const sequelize = new Sequelize('sqlite:/home/abs/dbname.db', {storage: '/completely/different/path.db'});
          const options = sequelize.options;
          expect(options.dialect).to.equal('sqlite');
          expect(options.storage).to.equal('/completely/different/path.db');
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

    it('should use the default port when no other is specified', () => {
      const sequelize = new Sequelize('dbname', 'root', 'pass', {
          dialect
        }),
        config = sequelize.config;
      let port;

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
