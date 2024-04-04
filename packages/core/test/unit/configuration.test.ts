import { Sequelize } from '@sequelize/core';
import { PostgresDialect } from '@sequelize/postgres';
import { SqliteDialect } from '@sequelize/sqlite';
import { expect } from 'chai';
import path from 'node:path';
import sinon from 'sinon';
import {
  allowDeprecationsInSuite,
  createSequelizeInstance,
  getTestDialectClass,
  sequelize,
} from '../support';

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

  it('throws when an invalid dialect is supplied', () => {
    expect(() => {
      // @ts-expect-error -- testing that this throws
      new Sequelize({ dialect: 'some-fancy-dialect' });
    }).to.throw(
      Error,
      'The dialect some-fancy-dialect is not natively supported. Native dialects: mariadb, mssql, mysql, postgres, sqlite, ibmi, db2 and snowflake.',
    );
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

  it('warns if the database version is not supported', () => {
    const stub = sinon.stub(process, 'emitWarning');
    try {
      createSequelizeInstance({ databaseVersion: '0.0.1' });
      expect(stub.getCalls()[0].args[0]).to.contain(
        'This database engine version is not supported, please update your database server.',
      );
    } finally {
      stub.restore();
    }
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
  });

  describe('Postgres URL parsing', () => {
    if (dialectName !== 'postgres') {
      return;
    }

    it('supports not providing username, password, or port in URI, but providing them in the option bag', () => {
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

    it('handles the "options" parameter as JSON', () => {
      const newSequelize = new Sequelize({
        dialect: PostgresDialect,
        // TODO: why does it accept a JSON string? The pg documentation & source code indicates that "options" is a string
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

    it('accepts options as a non-json value', () => {
      const newSequelize = new Sequelize({
        dialect: PostgresDialect,
        url: `${dialectName}://example.com:9821/dbname?options=${encodeURIComponent('-c search_path=test_schema')}`,
      });

      expect(newSequelize.options.replication.write.options).to.equal('-c search_path=test_schema');
    });

    it('prioritizes the ?host querystring parameter over the rest of the URI', () => {
      const newSequelize = new Sequelize<PostgresDialect>({
        dialect: PostgresDialect,
        url: `${dialectName}://localhost:9821/dbname?host=/tmp/mysocket`,
      });

      expect(newSequelize.options.replication.write.host).to.equal('/tmp/mysocket');
    });

    it('supports using a socket path as an encoded domain', () => {
      const newSequelize = new Sequelize<PostgresDialect>({
        dialect: PostgresDialect,
        url: `${dialectName}://${encodeURIComponent('/tmp/mysocket')}:9821/dbname`,
      });

      expect(newSequelize.options.replication.write.host).to.equal('/tmp/mysocket');
    });

    it('supports connection strings in replication options', async () => {
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

    it('accepts the postgresql protocol', () => {
      // should not throw
      new Sequelize({
        dialect: PostgresDialect,
        url: `postgresql://localhost:9821/dbname?ssl=true`,
      });
    });
  });

  describe('SQLite URL parsing', () => {
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

  it('supports properly formatted URLs', () => {
    const newSequelize = new Sequelize({
      dialect: SqliteDialect,
      url: 'sqlite://test/sqlite-databases/connection-string-test1.sqlite',
    });

    const options = newSequelize.options;
    expect(options.replication.write.storage).to.equal(
      path.resolve('test/sqlite-databases/connection-string-test1.sqlite'),
    );
  });
});
