import path from 'node:path';
import type { Dialect } from '@sequelize/core';
import { Sequelize } from '@sequelize/core';
import { expect } from 'chai';
import { getSequelizeInstance, getTestDialect } from '../support';

const dialect = getTestDialect();
describe('Sequelize constructor', () => {
  it('throws when no dialect is supplied', () => {
    expect(() => {
      new Sequelize('localhost', 'test', 'test');
    }).to.throw(Error);
  });

  it('works when dialect is supplied', () => {
    expect(() => {
      new Sequelize('localhost', 'test', 'test', {
        dialect,
      });
    }).not.to.throw();
  });

  it('throws if pool:false', () => {
    expect(() => {
      new Sequelize('localhost', 'test', 'test', {
        dialect,
        // @ts-expect-error -- we're testing that this throws an error
        pool: false,
      });
    }).to.throw('Support for pool:false was removed in v4.0');
  });

  describe('Network Connections (non-sqlite)', () => {
    if (dialect === 'sqlite') {
      return;
    }

    it('accepts four parameters (database, username, password, options)', () => {
      const sequelize = new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialect,
        dialectOptions: {
          supportBigNumbers: true,
          bigNumberStrings: true,
        },
      });

      const options = sequelize.options;
      expect(options.dialect).to.equal(dialect);
      expect(options.database).to.equal('dbname');
      expect(options.username).to.equal('root');
      expect(options.password).to.equal('pass');
      expect(options.port).to.equal(999);

      const config = sequelize.config;
      expect(config.database).to.equal('dbname');
      expect(config.username).to.equal('root');
      expect(config.password).to.equal('pass');
      expect(config.port).to.equal(999);
      expect(config.dialectOptions.supportBigNumbers).to.be.true;
      expect(config.dialectOptions.bigNumberStrings).to.be.true;

      expect(config.replication.write).to.deep.eq({
        database: 'dbname',
        host: 'localhost',
        password: 'pass',
        port: 999,
        protocol: 'tcp',
        ssl: undefined,
        username: 'root',
        dialectOptions: {
          bigNumberStrings: true,
          supportBigNumbers: true,
        },
      });
    });

    it('accepts a single URI parameter', () => {
      const sequelize = new Sequelize(`${dialect}://user:pass@example.com:9821/dbname`);
      const config = sequelize.config;
      const options = sequelize.options;

      expect(options.dialect).to.equal(dialect);

      expect(config.database).to.equal('dbname');
      expect(config.host).to.equal('example.com');
      expect(config.username).to.equal('user');
      expect(config.password).to.equal('pass');
      expect(config.port).to.equal(9821);
      expect(config.replication.write).to.deep.eq({
        database: 'dbname',
        username: 'user',
        password: 'pass',
        host: 'example.com',
        port: 9821,
        protocol: 'tcp',
        ssl: undefined,
        dialectOptions: {},
      });
      expect(config.replication.read).to.deep.eq([]);
    });

    it('supports not providing username, password, or port', () => {
      const sequelize = new Sequelize(`${dialect}://example.com/dbname`);
      const config = sequelize.config;

      const defaultPort: Record<Dialect, number> = {
        postgres: 5432,
        db2: 3306,
        ibmi: 25_000,
        mariadb: 3306,
        mssql: 1433,
        mysql: 3306,
        snowflake: 3306,
        sqlite: 0,
      };

      expect(config.replication.write).to.deep.eq({
        database: 'dbname',
        host: 'example.com',
        port: defaultPort[dialect],
        protocol: 'tcp',
        ssl: undefined,
        username: undefined,
        password: null,
        dialectOptions: {},
      });
    });

    it('supports not providing username, password, or port in URI, but providing them in the option bag', () => {
      const options = {
        port: 10,
        username: 'root',
        password: 'pass',
        database: 'dbname',
      };
      const sequelize = new Sequelize(`${dialect}://example.com/dbname`, options);

      expect(sequelize.config.replication.write).to.deep.eq({
        host: 'example.com',
        protocol: 'tcp',
        ssl: undefined,
        dialectOptions: {},
        ...options,
      });
    });

    it('merges querystring parameters with dialectOptions', () => {
      const sequelize = new Sequelize(`${dialect}://example.com:9821/dbname?an_option=123&other_option=abc`, {
        dialectOptions: {
          thirdOption: 3,
        },
      });

      expect(sequelize.config.replication.write).to.deep.eq({
        database: 'dbname',
        host: 'example.com',
        password: null,
        port: 9821,
        ssl: undefined,
        username: undefined,
        protocol: 'tcp',
        dialectOptions: {
          an_option: '123',
          other_option: 'abc',
          thirdOption: 3,
        },
      });
    });

    it('handle JSON dialectOptions in querystring parameters', () => {
      const sequelize = new Sequelize(`${dialect}://example.com:9821/dbname?options=${encodeURIComponent(`{"encrypt":true}`)}&anotherOption=1`);

      expect(sequelize.options.dialectOptions.options?.encrypt).to.be.true;
      expect(sequelize.options.dialectOptions.anotherOption).to.equal('1');

      expect(sequelize.config.replication.write).to.deep.eq({
        database: 'dbname',
        host: 'example.com',
        password: null,
        port: 9821,
        ssl: undefined,
        username: undefined,
        protocol: 'tcp',
        dialectOptions: {
          options: { encrypt: true },
          anotherOption: '1',
        },
      });
    });

    it('priorises the ?host querystring parameter over the rest of the URI', () => {
      const sequelize = new Sequelize(`${dialect}://localhost:9821/dbname?host=example.com`);

      const options = sequelize.options;
      expect(options.host).to.equal('example.com');
      expect(options.replication.write.host).to.equal('example.com');
    });

    it('supports connection strings in replication options', async () => {
      const uri = `${dialect}://username:password@host:1234/database`;

      const sequelize = getSequelizeInstance('', '', '', {
        replication: {
          write: uri,
          read: [uri],
        },
      });

      expect(sequelize.dialect.name).to.eq(dialect);

      const options = {
        dialect,
        host: 'host',
        database: 'database',
        port: 1234,
        username: 'username',
        password: 'password',
        dialectOptions: {},
        protocol: 'tcp',
        ssl: undefined,
      };

      expect(sequelize.options.replication.write).to.deep.eq(options);
      expect(sequelize.options.replication.read).to.deep.eq([options]);
    });

    it('priorises the option bag over the URI', () => {
      const sequelize = new Sequelize(`${dialect}://localhost:9821/dbname?anOption=1`, {
        host: 'localhost2',
        username: 'username2',
        password: 'password2',
        port: '2000',
        database: 'dbname2',
        dialectOptions: {
          anOption: 2,
        },
      });

      const options = sequelize.options;
      expect(options.host).to.equal('localhost2');
      expect(options.username).to.equal('username2');
      expect(options.password).to.equal('password2');
      expect(options.port).to.equal(2000);
      expect(options.database).to.equal('dbname2');

      const config = sequelize.options;
      expect(config.host).to.equal('localhost2');
      expect(config.username).to.equal('username2');
      expect(config.password).to.equal('password2');
      expect(config.port).to.equal(2000);
      expect(config.database).to.equal('dbname2');

      expect(options.replication.write).to.deep.eq({
        host: 'localhost2',
        username: 'username2',
        password: 'password2',
        port: 2000,
        database: 'dbname2',
        dialectOptions: {
          anOption: 2,
        },
        protocol: 'tcp',
        ssl: undefined,
      });
      expect(config.replication.read).to.deep.eq([]);
    });

    it('priorises the option bad over the individual parameters', () => {
      const sequelize = new Sequelize('database1', 'username1', 'password1', {
        dialect,
        port: 1000,
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
        port: 1000,
        dialectOptions: {},
        protocol: 'tcp',
        ssl: undefined,
      });
      expect(config.replication.read).to.deep.eq([]);
    });
  });

  describe('Filesystem connections (sqlite)', () => {
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
