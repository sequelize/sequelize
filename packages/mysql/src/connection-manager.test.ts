import type { ConnectionOptions } from '@sequelize/core';
import { ConnectionError, Sequelize } from '@sequelize/core';
import { MySqlDialect } from '@sequelize/mysql';
import { expect } from 'chai';
import { EventEmitter } from 'node:events';

type QueryCallback = (error: Error | null) => void;

class FakeMySqlConnection extends EventEmitter {
  destroyCallCount = 0;
  endCallCount = 0;
  queries: string[] = [];

  constructor(private readonly queryError: Error | null) {
    super();

    // mysql2 emits "connect" once the handshake succeeded.
    process.nextTick(() => {
      this.emit('connect');
    });
  }

  query(sql: string, callback: QueryCallback): void {
    this.queries.push(sql);
    process.nextTick(() => {
      callback(this.queryError);
    });
  }

  destroy(): void {
    this.destroyCallCount++;
  }

  end(callback?: (error?: Error | null) => void): void {
    this.endCallCount++;
    process.nextTick(() => {
      callback?.();
    });
  }
}

function createSequelizeWithFakeMysql2(
  queryError: Error | null,
  timezone: string = '+05:30',
): {
  sequelize: Sequelize<MySqlDialect>;
  connectionConfig: ConnectionOptions<MySqlDialect>;
  getConnections(): FakeMySqlConnection[];
} {
  const connections: FakeMySqlConnection[] = [];

  const mysql2Module = {
    createConnection() {
      const connection = new FakeMySqlConnection(queryError);
      connections.push(connection);

      return connection;
    },
  } as any;

  const sequelize = new Sequelize<MySqlDialect>({
    dialect: MySqlDialect,
    host: 'localhost',
    port: 3306,
    user: 'user',
    password: 'password',
    database: 'db',
    timezone,
    mysql2Module,
  });

  const connectionConfig: ConnectionOptions<MySqlDialect> = {
    host: 'localhost',
    port: 3306,
    user: 'user',
    password: 'password',
    database: 'db',
  };

  return { sequelize, connectionConfig, getConnections: () => connections };
}

describe('MySqlConnectionManager#initializeConnection', () => {
  it('sets the session time zone and resolves when the query succeeds', async () => {
    const { sequelize, connectionConfig, getConnections } = createSequelizeWithFakeMysql2(null);
    const { connectionManager } = sequelize.dialect;

    const connection = await connectionManager.connect(connectionConfig);

    const [fakeConnection] = getConnections();
    expect(connection).to.equal(fakeConnection);
    expect(fakeConnection.queries).to.deep.equal([]);

    await connectionManager.initializeConnection(connection);

    expect(fakeConnection.queries).to.deep.equal([`SET time_zone = '+05:30'`]);
    expect(fakeConnection.destroyCallCount).to.equal(0);
    expect(fakeConnection.endCallCount).to.equal(0);
  });

  // https://github.com/sequelize/sequelize/issues/18266
  it('destroys the connection when the SET time_zone query fails', async () => {
    const queryError = new Error(
      'Query declined - system memory is critically low. This action was taken to protect system stability.',
    );
    const { sequelize, connectionConfig, getConnections } =
      createSequelizeWithFakeMysql2(queryError);

    const { connectionManager } = sequelize.dialect;
    const connection = await connectionManager.connect(connectionConfig);

    const error = await connectionManager.initializeConnection(connection).then(
      () => null,
      (error_: unknown) => error_,
    );

    expect(error).to.be.instanceOf(ConnectionError);
    expect((error as ConnectionError).cause).to.equal(queryError);

    const [fakeConnection] = getConnections();
    expect(fakeConnection.queries).to.deep.equal([`SET time_zone = '+05:30'`]);
    expect(fakeConnection.destroyCallCount).to.equal(1);
    expect(fakeConnection.endCallCount).to.equal(0);
  });

  it('destroys the connection when the named time zone is invalid', async () => {
    const { sequelize, connectionConfig, getConnections } = createSequelizeWithFakeMysql2(
      null,
      'Invalid/Timezone',
    );
    const { connectionManager } = sequelize.dialect;
    const connection = await connectionManager.connect(connectionConfig);

    const error = await connectionManager.initializeConnection(connection).then(
      () => null,
      (error_: unknown) => error_,
    );

    expect(error).to.be.instanceOf(ConnectionError);
    expect((error as ConnectionError).cause).to.have.property(
      'message',
      'Invalid time zone: Invalid/Timezone',
    );

    const [fakeConnection] = getConnections();
    expect(fakeConnection.queries).to.deep.equal([]);
    expect(fakeConnection.destroyCallCount).to.equal(1);
    expect(fakeConnection.endCallCount).to.equal(0);
  });

  it('only replaces the placeholder error listener', async () => {
    const { sequelize, connectionConfig } = createSequelizeWithFakeMysql2(null);
    const { connectionManager } = sequelize.dialect;

    const connection = await connectionManager.connect(connectionConfig);
    const otherListener = () => {};

    connection.on('error', otherListener);
    expect(connection.listenerCount('error')).to.equal(2);

    await connectionManager.initializeConnection(connection);

    const listeners = connection.listeners('error');
    expect(listeners).to.have.length(2);
    expect(listeners).to.include(otherListener);

    // The other listener is the real handler, which destroys the connection.
    const destroyed: unknown[] = [];
    Object.assign(sequelize.pool, {
      async destroy(destroyedConnection: unknown) {
        destroyed.push(destroyedConnection);
      },
    });
    connection.emit('error', Object.assign(new Error('connection lost'), { code: 'ECONNRESET' }));
    expect(destroyed).to.have.length(1);
    expect(destroyed[0]).to.equal(connection);
  });
});
