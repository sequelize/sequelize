import path from 'node:path';
import { Sequelize } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialect } from '../support';

const dialect = getTestDialect();
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
          dialect: 'mysql',
        });
      }).not.to.throw(Error);
    });
  });

  it('should throw error if pool:false', () => {
    expect(() => {
      new Sequelize('localhost', 'test', 'test', {
        dialect: 'mysql',
        // @ts-expect-error -- we're testing that this throws an error
        pool: false,
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
          bigNumberStrings: true,
        },
      });

      const options = sequelize.options;
      expect(options.database).to.equal('dbname');
      expect(options.username).to.equal('root');
      expect(options.password).to.equal('pass');
      expect(options.port).to.equal(999);

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
      expect(config.replication.write).to.deep.eq({
        database: 'dbname',
        username: 'user',
        password: 'pass',
        host: 'example.com',
        port: '9821',
        protocol: 'tcp',
        ssl: undefined,
        dialectOptions: {},
      });
      expect(config.replication.read).to.deep.eq([]);
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
        database: 'dbname',
      };
      const sequelize = new Sequelize('mysql://example.com:9821', options);
      const config = sequelize.config;

      expect(config.username).to.equal(options.username);
      expect(config.password).to.equal(options.password);
      expect(config.database).to.equal(options.database);
    });

    it('should use the default port when no other is specified', () => {
      const sequelize = new Sequelize('dbname', 'root', 'pass', {
        dialect,
      });
      const config = sequelize.config;
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
          application_name: 'server',
        },
      });

      const options = sequelize.options;
      const dialectOptions = sequelize.config.dialectOptions;

      expect(options.storage).to.equal('/completely/different/path.db');
      expect(dialectOptions.supportBigNumbers).to.be.true;
      expect(dialectOptions.application_name).to.equal('server');
      expect(dialectOptions.ssl).to.equal('true');
    });

    it('should handle JSON options', () => {
      const sequelizeWithOptions = new Sequelize('mysql://example.com:9821/dbname?options={"encrypt":true}&anotherOption=1');
      expect(sequelizeWithOptions.options.dialectOptions.options?.encrypt).to.be.true;
      expect(sequelizeWithOptions.options.dialectOptions.anotherOption).to.equal('1');
    });

    it('priorises the ?host option over the URI hostname', () => {
      const sequelize = new Sequelize('mysql://localhost:9821/dbname?host=example.com');

      const options = sequelize.options;
      expect(options.host).to.equal('example.com');
      expect(options.replication.write.host).to.equal('example.com');
    });

    it('priorises the option bag over the URI', () => {
      const sequelize = new Sequelize('mysql://localhost:9821/dbname', {
        host: 'localhost2',
        username: 'username2',
        password: 'password2',
        port: '2000',
        database: 'dbname2',
      });

      const options = sequelize.options;
      expect(options.host).to.equal('localhost2');
      expect(options.username).to.equal('username2');
      expect(options.password).to.equal('password2');
      expect(options.port).to.equal('2000');
      expect(options.database).to.equal('dbname2');

      const config = sequelize.options;
      expect(config.host).to.equal('localhost2');
      expect(config.username).to.equal('username2');
      expect(config.password).to.equal('password2');
      expect(config.port).to.equal('2000');
      expect(config.database).to.equal('dbname2');

      expect(options.replication.write).to.deep.eq({
        host: 'localhost2',
        username: 'username2',
        password: 'password2',
        port: '2000',
        database: 'dbname2',
        dialectOptions: {},
        protocol: 'tcp',
        ssl: undefined,
      });
      expect(config.replication.read).to.deep.eq([]);
    });

    it('priorises the option bad over the individual parameters', () => {
      const sequelize = new Sequelize('database1', 'username1', 'password1', {
        dialect: 'mysql',
        database: 'database2',
        username: 'username2',
        password: 'password2',
      });

      const options = sequelize.options;
      expect(options.database).to.equal('database2');
      expect(options.username).to.equal('username2');
      expect(options.password).to.equal('password2');

      const config = sequelize.config;
      expect(config.database).to.equal('database2');
      expect(config.username).to.equal('username2');
      expect(config.password).to.equal('password2');

      expect(options.replication.write).to.deep.eq(config.replication.write);
      expect(options.replication.write).to.deep.eq({
        username: 'username2',
        password: 'password2',
        database: 'database2',
        host: 'localhost',
        port: undefined,
        dialectOptions: {},
        protocol: 'tcp',
        ssl: undefined,
      });
      expect(config.replication.read).to.deep.eq([]);
    });

    describe('SQLite path inititalization', () => {
      if (dialect !== 'sqlite') {
        return;
      }

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
    });
  });
});
