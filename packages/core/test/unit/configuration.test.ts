import { Sequelize } from '@sequelize/core';
import { PostgresDialect } from '@sequelize/postgres';
import { SqliteDialect } from '@sequelize/sqlite';
import { expect } from 'chai';
import path from 'node:path';
import { allowDeprecationsInSuite, getTestDialectClass, sequelize } from '../support';

const dialect = getTestDialectClass();
const dialectName = sequelize.dialect.name;

describe('Sequelize constructor', () => {
  allowDeprecationsInSuite(['SEQUELIZE0027']);

  it('throws when no dialect is supplied', () => {
    expect(() => {
      // @ts-expect-error -- testing that this throws when the "dialect" option is missing
      new Sequelize({});
    }).to.throw(Error);
  });

  it('works when dialect is supplied', () => {
    expect(() => {
      new Sequelize({
        dialect,
      });
    }).not.to.throw();
  });

  it('throws if pool:false', () => {
    expect(() => {
      new Sequelize({
        dialect,
        // @ts-expect-error -- we're testing that this throws an error
        pool: false,
      });
    }).to.throw(
      'Setting the "pool" option to "false" is not supported since Sequelize 4. To disable the pool, set the "pool"."max" option to 1.',
    );
  });

  describe('Network Connections (non-sqlite)', () => {
    if (dialectName === 'sqlite') {
      return;
    }

    it('should correctly set the host and the port', () => {
      // options are dialect-specific, but they're overwritten identically in every dialect
      if (dialectName !== 'postgres') {
        return;
      }

      const localSequelize = new Sequelize({
        dialect: PostgresDialect,
        host: '127.0.0.1',
        port: 1234,
      });
      expect(localSequelize.options.replication.write.port).to.equal(1234);
      expect(localSequelize.options.replication.write.host).to.equal('127.0.0.1');
    });

    it('accepts a single URI parameter', () => {
      const newSequelize = new Sequelize({
        dialect,
        url: `${dialectName}://user:pass@example.com:9821/dbname`,
      });

      const replication = newSequelize.options.replication;

      expect(replication.write).to.deep.eq({
        database: 'dbname',
        user: 'user',
        password: 'pass',
        host: 'example.com',
        port: 9821,
      });

      expect(replication.read).to.deep.eq([]);
    });

    it('supports not providing username, password, or port', () => {
      const newSequelize = new Sequelize({
        dialect,
        url: `${dialectName}://example.com/dbname`,
      });

      const replication = newSequelize.options.replication;

      expect(replication.write).to.deep.eq({
        database: 'dbname',
        host: 'example.com',
      });
    });

    it('supports not providing username, password, or port in URI, but providing them in the option bag', () => {
      // options are dialect-specific, but they're overwritten identically in every dialect
      if (dialectName !== 'postgres') {
        return;
      }

      const options = {
        port: 10,
        user: 'root',
        password: 'pass',
        database: 'dbname',
      };

      const newSequelize = new Sequelize({
        dialect: PostgresDialect,
        url: `${dialectName}://example.com/dbname`,
        ...options,
      });

      expect(newSequelize.options.replication.write).to.deep.eq({
        host: 'example.com',
        ...options,
      });
    });

    it('merges querystring parameters with connection options', () => {
      // TODO: when implementing the different url parser per dialect, add separate test per dialect
      if (dialectName !== 'postgres') {
        return;
      }

      const newSequelize = new Sequelize<PostgresDialect>({
        dialect: PostgresDialect,
        url: `${dialectName}://example.com:9821/dbname?ssl=true&application_name=abc`,
      });

      expect(newSequelize.options.replication.write).to.deep.eq({
        database: 'dbname',
        host: 'example.com',
        port: 9821,
        ssl: true,
        application_name: 'abc',
      });
    });

    it('[postgres] handles the "options" parameter as JSON', () => {
      if (dialectName !== 'postgres') {
        return;
      }

      const newSequelize = new Sequelize<PostgresDialect>({
        dialect: PostgresDialect,
        url: `${dialectName}://example.com:9821/dbname?options=${encodeURIComponent(`{"encrypt":true}`)}&ssl=true`,
      });

      expect(newSequelize.options.replication.write).to.deep.eq({
        database: 'dbname',
        host: 'example.com',
        port: 9821,
        ssl: true,
        options: { encrypt: true },
      });
    });

    it('prioritizes the ?host querystring parameter over the rest of the URI', () => {
      // TODO: when implementing the different url parser per dialect, add separate test per dialect
      if (dialectName !== 'postgres') {
        return;
      }

      const newSequelize = new Sequelize<PostgresDialect>({
        dialect: PostgresDialect,
        url: `${dialectName}://localhost:9821/dbname?host=/tmp/mysocket`,
      });

      expect(newSequelize.options.replication.write.host).to.equal('/tmp/mysocket');
    });

    it('supports using a socket path as an encoded domain', () => {
      // TODO: when implementing the different url parser per dialect, add separate test per dialect
      if (dialectName !== 'postgres') {
        return;
      }

      const newSequelize = new Sequelize<PostgresDialect>({
        dialect: PostgresDialect,
        url: `${dialectName}://${encodeURIComponent('/tmp/mysocket')}:9821/dbname`,
      });

      expect(newSequelize.options.replication.write.host).to.equal('/tmp/mysocket');
    });

    it('supports connection strings in replication options', async () => {
      // TODO: when implementing the different url parser per dialect, add separate test per dialect
      if (dialectName !== 'postgres') {
        return;
      }

      const url = `${dialectName}://username:password@host:1234/database`;

      const newSequelize = new Sequelize<PostgresDialect>({
        dialect: PostgresDialect,
        replication: {
          write: url,
          read: [url],
        },
      });

      const options = {
        host: 'host',
        database: 'database',
        port: 1234,
        user: 'username',
        password: 'password',
      };

      expect(newSequelize.options.replication.write).to.deep.eq(options);
      expect(newSequelize.options.replication.read).to.deep.eq([options]);
    });

    it('prioritizes the option bag over the URI', () => {
      // TODO: when implementing the different url parser per dialect, add separate test per dialect
      if (dialectName !== 'postgres') {
        return;
      }

      const newSequelize = new Sequelize<PostgresDialect>({
        dialect: PostgresDialect,
        url: `${dialectName}://localhost:9821/dbname?ssl=true`,
        host: 'localhost2',
        user: 'username2',
        password: 'password2',
        ssl: false,
        port: 2000,
        database: 'dbname2',
      });

      const replication = newSequelize.options.replication;

      expect(replication.write).to.deep.eq({
        database: 'dbname2',
        host: 'localhost2',
        password: 'password2',
        port: 2000,
        ssl: false,
        user: 'username2',
      });
      expect(replication.read).to.deep.eq([]);
    });
  });

  describe('Filesystem connections (sqlite)', () => {
    if (dialectName !== 'sqlite') {
      return;
    }

    it('should accept relative paths for sqlite', () => {
      const newSequelize = new Sequelize<SqliteDialect>({
        dialect: SqliteDialect,
        url: 'sqlite:subfolder/dbname.db',
      });

      const options = newSequelize.options;
      expect(options.replication.write.storage).to.equal(path.resolve('subfolder', 'dbname.db'));
    });

    it('should accept absolute paths for sqlite', () => {
      const newSequelize = new Sequelize<SqliteDialect>({
        dialect: SqliteDialect,
        url: 'sqlite:/home/abs/dbname.db',
      });

      const options = newSequelize.options;
      expect(options.replication.write.storage).to.equal(path.resolve('/home/abs/dbname.db'));
    });

    it('should prefer storage in options object', () => {
      const newSequelize = new Sequelize<SqliteDialect>({
        dialect: SqliteDialect,
        url: 'sqlite:/home/abs/dbname.db',
        storage: '/completely/different/path.db',
      });

      const options = newSequelize.options;
      expect(options.replication.write.storage).to.equal('/completely/different/path.db');
    });

    it('supports sqlite://:memory:', () => {
      const newSequelize = new Sequelize<SqliteDialect>({
        dialect: SqliteDialect,
        url: 'sqlite://:memory:',
      });

      const options = newSequelize.options;
      expect(options.replication.write.storage).to.equal(':memory:');
    });

    it('supports sqlite::memory:', () => {
      const newSequelize = new Sequelize<SqliteDialect>({
        dialect: SqliteDialect,
        url: 'sqlite::memory:',
      });

      const options = newSequelize.options;
      expect(options.replication.write.storage).to.equal(':memory:');
    });
  });
});
