import * as chai from 'chai';
import Support from './support.js';

const expect = chai.expect;

const Sequelize = Support.Sequelize;
const dialect = Support.getTestDialect();

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
          dialect: 'postgres'
        });
      }).not.to.throw(Error);
    });

    it('throws for a dialect that is no longer supported', () => {
      expect(() => {
        new Sequelize('localhost', 'test', 'test', {
          dialect: 'mysql'
        });
      }).to.throw('The dialect mysql is not supported. Supported dialects: postgres.');
    });
  });

  it('should throw error if pool:false', () => {
    expect(() => {
      new Sequelize('localhost', 'test', 'test', {
        dialect: 'postgres',
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
      const sequelize = new Sequelize('postgres://user:pass@example.com:9821/dbname');
      const config = sequelize.config;
      const options = sequelize.options;

      expect(options.dialect).to.equal('postgres');

      expect(config.database).to.equal('dbname');
      expect(config.host).to.equal('example.com');
      expect(config.username).to.equal('user');
      expect(config.password).to.equal('pass');
      expect(config.port).to.equal('9821');
    });

    it('should work with no authentication options', () => {
      const sequelize = new Sequelize('postgres://example.com:9821/dbname');
      const config = sequelize.config;

      expect(config.username).to.not.be.ok;
      expect(config.password).to.be.null;
    });

    it('should work with no authentication options and passing additional options', () => {
      const sequelize = new Sequelize('postgres://example.com:9821/dbname', {});
      const config = sequelize.config;

      expect(config.username).to.not.be.ok;
      expect(config.password).to.be.null;
    });

    it('should use the default port when no other is specified', () => {
      const sequelize = new Sequelize('dbname', 'root', 'pass', {
          dialect
        }),
        config = sequelize.config;

      expect(config.port).to.equal(5432);
    });
  });
});
