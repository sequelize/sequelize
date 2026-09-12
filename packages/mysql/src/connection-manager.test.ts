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

function createSequelizeWithFakeMysql2(queryError: Error | null): {
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
    timezone: '+05:30',
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

describe('MySqlConnectionManager#connect', () => {
  it('sets the session time zone and resolves when the query succeeds', async () => {
    const { sequelize, connectionConfig, getConnections } = createSequelizeWithFakeMysql2(null);

    const connection = await sequelize.dialect.connectionManager.connect(connectionConfig);

    const [fakeConnection] = getConnections();
    expect(connection).to.equal(fakeConnection);
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

    let caughtError: unknown;
    try {
      await sequelize.dialect.connectionManager.connect(connectionConfig);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).to.be.instanceOf(ConnectionError);
    expect((caughtError as ConnectionError).cause).to.equal(queryError);

    // The pool never receives a connection whose setup failed, so connect()
    // must close it itself or the socket is orphaned.
    const [fakeConnection] = getConnections();
    expect(fakeConnection.queries).to.deep.equal([`SET time_zone = '+05:30'`]);
    expect(fakeConnection.destroyCallCount).to.equal(1);
    expect(fakeConnection.endCallCount).to.equal(0);
  });
});
