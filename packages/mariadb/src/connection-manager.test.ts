import { ConnectionError, Sequelize } from '@sequelize/core';
import { MariaDbDialect } from '@sequelize/mariadb';
import { expect } from 'chai';

const VERIFY_QUERY = 'SELECT @@character_set_client AS cs, @@collation_connection AS coll';

// The connector's promise API resolves to a ConnectionPromise wrapper: it exposes
// threadId/info/prepareCache getters and methods, but NOT the inner connection's
// resolved options. Fakes deliberately model that shape (no `opts`) so the tests
// cannot pass by reading state a real connection does not expose.
function makeFakeConnection(overrides: Record<string, unknown>) {
  return {
    serverVersion: () => '10.11.0-MariaDB',
    on() {
      return this;
    },
    off() {
      return this;
    },
    async query(sql: string) {
      throw new Error(`unexpected query: ${sql}`);
    },
    async end() {},
    isValid: () => true,
    ...overrides,
  };
}

function makeSequelize(fakeConnection: unknown) {
  return new Sequelize<MariaDbDialect>({
    dialect: MariaDbDialect,
    mariaDbModule: {
      async createConnection() {
        return fakeConnection;
      },
    } as any,
  });
}

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
    const fakeConnection = makeFakeConnection({
      async query(sql: string) {
        if (sql === VERIFY_QUERY) {
          verificationQueryRan = true;

          return [{ cs: 'utf8mb4', coll: 'utf8mb4_unicode_ci' }];
        }

        throw new Error(`unexpected query: ${sql}`);
      },
    });
    const sequelize = makeSequelize(fakeConnection);

    const connection = await sequelize.dialect.connectionManager.connect({
      charset: 'utf8mb4',
    });

    expect(connection).to.equal(fakeConnection);
    expect(verificationQueryRan).to.equal(true);
  });

  it('connects when the server honors the utf8 alias of utf8mb3', async () => {
    const fakeConnection = makeFakeConnection({
      async query() {
        return [{ cs: 'utf8mb3', coll: 'utf8mb3_general_ci' }];
      },
    });
    const sequelize = makeSequelize(fakeConnection);

    expect(await sequelize.dialect.connectionManager.connect({ charset: 'utf8' })).to.equal(
      fakeConnection,
    );
  });

  it('throws a ConnectionError when the server does not support the requested charset', async () => {
    let endCalled = false;
    const fakeConnection = makeFakeConnection({
      // The server does not know gb18030: the session silently stays on utf8mb4
      async query() {
        return [{ cs: 'utf8mb4', coll: 'utf8mb4_unicode_ci' }];
      },
      async end() {
        endCalled = true;
      },
    });
    const sequelize = makeSequelize(fakeConnection);

    const error = await sequelize.dialect.connectionManager.connect({ charset: 'gb18030' }).then(
      () => null,
      (error_: unknown) => error_,
    );

    expect(error).to.be.instanceOf(ConnectionError);
    expect((error as ConnectionError).cause).to.have.property(
      'message',
      "The MariaDB server does not support the requested charset/collation 'gb18030' (session uses charset 'utf8mb4', collation 'utf8mb4_unicode_ci'). " +
        'Refusing to connect: the client-side string escaper would be desynced from the server, ' +
        'which can enable SQL injection (https://github.com/sequelize/sequelize/issues/18282).',
    );
    expect(endCalled).to.equal(true);
  });

  it('does not verify the session charset when no charset or collation was requested', async () => {
    let queryCalled = false;
    const fakeConnection = makeFakeConnection({
      async query() {
        queryCalled = true;

        return [];
      },
    });
    const sequelize = makeSequelize(fakeConnection);

    await sequelize.dialect.connectionManager.connect({});

    expect(queryCalled).to.equal(false);
  });

  it('accepts a requested collation honored by the server that differs from the server default', async () => {
    const fakeConnection = makeFakeConnection({
      // info.collation is the server default from the initial handshake; the connector
      // does not update it for a requested collation, so the check must not read it.
      info: { collation: { charset: 'utf8', maxLength: 4 } },
      async query() {
        // The server honored latin1: the session uses it, not the utf8mb4 default
        return [{ cs: 'latin1', coll: 'latin1_swedish_ci' }];
      },
    });
    const sequelize = makeSequelize(fakeConnection);

    const connection = await sequelize.dialect.connectionManager.connect({
      collation: 'latin1_swedish_ci',
    });

    expect(connection).to.equal(fakeConnection);
  });

  it('throws when the server silently keeps its default instead of the requested collation', async () => {
    let endCalled = false;
    const fakeConnection = makeFakeConnection({
      info: { collation: { charset: 'utf8', maxLength: 4 } },
      // The server does not know latin1 here: the session stays on the utf8mb4 default
      async query() {
        return [{ cs: 'utf8mb4', coll: 'utf8mb4_unicode_ci' }];
      },
      async end() {
        endCalled = true;
      },
    });
    const sequelize = makeSequelize(fakeConnection);

    const error = await sequelize.dialect.connectionManager
      .connect({ collation: 'latin1_swedish_ci' })
      .then(
        () => null,
        (error_: unknown) => error_,
      );

    expect(error).to.be.instanceOf(ConnectionError);
    expect(endCalled).to.equal(true);
  });

  it('accepts a valid collation whose name does not start with its charset', async () => {
    const fakeConnection = makeFakeConnection({
      async query() {
        return [{ cs: 'utf8mb4', coll: 'uca1400_ai_ci' }];
      },
    });
    const sequelize = makeSequelize(fakeConnection);

    const { connectionManager } = sequelize.dialect;

    expect(await connectionManager.connect({ collation: 'uca1400_ai_ci' })).to.equal(
      fakeConnection,
    );
    expect(await connectionManager.connect({ charset: 'uca1400_ai_ci' })).to.equal(fakeConnection);
  });

  it('attaches the temporary error listener before verifying the charset', async () => {
    const errorListeners: Array<() => void> = [];
    const fakeConnection = makeFakeConnection({
      on(_event: string, listener: () => void) {
        errorListeners.push(listener);

        return this;
      },
      async query() {
        // The connector's unexpectedPacket() emits 'error' directly for out-of-band
        // fatal packets; without a listener Node would throw an unhandled 'error'
        // event while this query is in flight.
        if (errorListeners.length === 0) {
          throw new Error("Unhandled 'error' event");
        }

        for (const listener of errorListeners) {
          listener();
        }

        return [{ cs: 'utf8mb4', coll: 'utf8mb4_unicode_ci' }];
      },
    });
    const sequelize = makeSequelize(fakeConnection);

    const connection = await sequelize.dialect.connectionManager.connect({
      charset: 'utf8mb4',
    });

    expect(connection).to.equal(fakeConnection);
  });

  it('closes the connection and rethrows the original error when the verification query fails', async () => {
    let endCalled = false;
    const queryError = Object.assign(new Error('query timeout'), { code: 'ETIMEDOUT' });
    const fakeConnection = makeFakeConnection({
      async query() {
        throw queryError;
      },
      async end() {
        endCalled = true;
      },
    });
    const sequelize = makeSequelize(fakeConnection);

    const error = await sequelize.dialect.connectionManager.connect({ charset: 'utf8mb4' }).then(
      () => null,
      (error_: unknown) => error_,
    );

    expect(error).to.be.instanceOf(ConnectionError);
    expect((error as ConnectionError).cause).to.equal(queryError);
    expect(endCalled).to.equal(true);
  });
});
