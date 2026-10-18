import { ConnectionError, Sequelize } from '@sequelize/core';
import { MariaDbDialect } from '@sequelize/mariadb';
import { expect } from 'chai';

describe('MariaDbConnectionManager#connect', () => {
  it('throws a ConnectionError when the named time zone is invalid', async () => {
    let createConnectionCalled = false;
    const sequelize = new Sequelize<MariaDbDialect>({
      dialect: MariaDbDialect,
      timezone: 'Invalid/Timezone',
      mariaDbModule: {
        async createConnection() {
          createConnectionCalled = true;
          throw new Error('createConnection should not be called');
        },
      } as any,
    });

    const error = await sequelize.dialect.connectionManager.connect({}).then(
      () => null,
      (error_: unknown) => error_,
    );

    expect(error).to.be.instanceOf(ConnectionError);
    expect((error as ConnectionError).cause).to.have.property(
      'message',
      'Invalid time zone: Invalid/Timezone',
    );
    expect(createConnectionCalled).to.equal(false);
  });

  it('connects when the server honors the requested charset', async () => {
    let verificationQueryRan = false;
    const fakeConnection = {
      serverVersion: () => '10.11.0-MariaDB',
      on() { return this; },
      off() { return this; },
      async query(sql: string) {
        if (sql === 'SELECT @@character_set_client AS cs') {
          verificationQueryRan = true;

          return [{ cs: 'utf8mb4' }];
        }

        throw new Error(`unexpected query: ${sql}`);
      },
      async end() {},
      isValid: () => true,
    };
    const sequelize = new Sequelize<MariaDbDialect>({
      dialect: MariaDbDialect,
      mariaDbModule: {
        async createConnection() {
          return fakeConnection;
        },
      } as any,
    });

    const connection = await sequelize.dialect.connectionManager.connect({
      charset: 'utf8mb4',
    });

    expect(connection).to.equal(fakeConnection);
    expect(verificationQueryRan).to.equal(true);
  });

  it('throws a ConnectionError when the server does not support the requested charset', async () => {
    let endCalled = false;
    const fakeConnection = {
      serverVersion: () => '10.11.0-MariaDB',
      on() { return this; },
      off() { return this; },
      // The server does not know gb18030: the session silently stays on utf8mb4
      async query() {
        return [{ cs: 'utf8mb4' }];
      },
      async end() {
        endCalled = true;
      },
      isValid: () => true,
    };
    const sequelize = new Sequelize<MariaDbDialect>({
      dialect: MariaDbDialect,
      mariaDbModule: {
        async createConnection() {
          return fakeConnection;
        },
      } as any,
    });

    const error = await sequelize.dialect.connectionManager
      .connect({ charset: 'gb18030' })
      .then(
        () => null,
        (error_: unknown) => error_,
      );

    expect(error).to.be.instanceOf(ConnectionError);
    expect((error as ConnectionError).cause).to.have.property(
      'message',
      'The MariaDB server does not support the requested charset \'gb18030\' (session uses \'utf8mb4\'). ' +
        'Refusing to connect: the client-side string escaper would be desynced from the server, ' +
        'which can enable SQL injection (https://github.com/sequelize/sequelize/issues/18282).',
    );
    expect(endCalled).to.equal(true);
  });

  it('does not verify the session charset when no charset or collation was requested', async () => {
    let queryCalled = false;
    const fakeConnection = {
      serverVersion: () => '10.11.0-MariaDB',
      on() { return this; },
      off() { return this; },
      async query() {
        queryCalled = true;

        return [];
      },
      async end() {},
      isValid: () => true,
    };
    const sequelize = new Sequelize<MariaDbDialect>({
      dialect: MariaDbDialect,
      mariaDbModule: {
        async createConnection() {
          return fakeConnection;
        },
      } as any,
    });

    await sequelize.dialect.connectionManager.connect({});

    expect(queryCalled).to.equal(false);
  });
});
