import type { AbstractConnection } from '@sequelize/core';
import { ConnectionAcquireTimeoutError, Sequelize } from '@sequelize/core';
import { expect } from 'chai';
import delay from 'delay';
import type { SinonSandbox } from 'sinon';
import sinon from 'sinon';
import {
  sequelize as baseSequelize,
  createSingleTransactionalTestSequelizeInstance,
  getTestDialect,
  sequelize,
  setResetMode,
} from './support';

const dialectName = getTestDialect();

function assertSameConnection(
  newConnection: AbstractConnection,
  oldConnection: AbstractConnection,
) {
  switch (dialectName) {
    case 'postgres':
      // @ts-expect-error -- untyped
      expect(oldConnection.processID).to.equal(newConnection.processID).and.to.be.ok;
      break;

    case 'mariadb':
    case 'mysql':
      // @ts-expect-error -- untyped
      expect(oldConnection.threadId).to.equal(newConnection.threadId).and.to.be.ok;
      break;

    case 'db2':
      // @ts-expect-error -- untyped
      expect(newConnection.connected).to.equal(oldConnection.connected).and.to.be.ok;
      break;

    case 'sqlite3':
    case 'mssql':
    case 'ibmi':
      // @ts-expect-error -- untyped
      expect(newConnection.dummyId).to.equal(oldConnection.dummyId).and.to.be.ok;
      break;

    case 'oracle':
      expect(oldConnection).to.be.equal(newConnection).and.to.be.ok;
      break;

    default:
      throw new Error('Unsupported dialect');
  }
}

function assertNewConnection(newConnection: AbstractConnection, oldConnection: AbstractConnection) {
  switch (dialectName) {
    case 'postgres':
      // @ts-expect-error -- untyped
      expect(oldConnection.processID).to.not.be.equal(newConnection.processID);
      break;

    case 'mariadb':
    case 'mysql':
      // @ts-expect-error -- untyped
      expect(oldConnection.threadId).to.not.be.equal(newConnection.threadId);
      break;

    case 'db2':
      // @ts-expect-error -- untyped
      expect(newConnection.connected).to.be.ok;
      // @ts-expect-error -- untyped
      expect(oldConnection.connected).to.not.be.ok;
      break;

    case 'mssql':
    case 'ibmi':
    case 'sqlite3':
      // @ts-expect-error -- untyped
      expect(newConnection.dummyId).to.not.be.ok;
      // @ts-expect-error -- untyped
      expect(oldConnection.dummyId).to.be.ok;
      break;

    case 'oracle':
      expect(oldConnection).to.not.be.equal(newConnection);
      break;

    default:
      throw new Error('Unsupported dialect');
  }
}

function attachMSSQLUniqueId(connection: AbstractConnection) {
  if (['mssql', 'ibmi', 'sqlite3'].includes(dialectName)) {
    // @ts-expect-error -- not typed, test only
    connection.dummyId = Math.random();
  }

  return connection;
}

describe('Pool', () => {
  if (process.env.DIALECT === 'postgres-native') {
    return;
  }

  setResetMode('none');

  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('network / connection errors', () => {
    it('should obtain new connection when old connection is abruptly closed', async () => {
      async function simulateUnexpectedError(connection: AbstractConnection) {
        // should never be returned again
        if (['mssql', 'ibmi', 'sqlite3'].includes(dialectName)) {
          connection = attachMSSQLUniqueId(connection);
        }

        if (dialectName === 'db2' || dialectName === 'mariadb' || dialectName === 'sqlite3') {
          await newSequelize.pool.destroy(connection);
        } else {
          const error: NodeJS.ErrnoException = new Error('Test ECONNRESET Error');
          error.code = 'ECONNRESET';
          // @ts-expect-error -- emit not declared yet
          connection.emit('error', error);
        }
      }

      // This function makes
      const newSequelize = await createSingleTransactionalTestSequelizeInstance(baseSequelize, {
        pool: { max: 1, idle: 5000 },
      });

      const cm = newSequelize.dialect.connectionManager;

      const firstConnection = await newSequelize.pool.acquire();
      await simulateUnexpectedError(firstConnection);
      expect(newSequelize.pool.using).to.eq(
        0,
        'first connection should have errored and not be in use anymore',
      );

      expect(newSequelize.pool.size).to.eq(
        0,
        'first connection should have errored and not be in pool anymore',
      );

      const secondConnection = await newSequelize.pool.acquire();

      assertNewConnection(secondConnection, firstConnection);

      expect(newSequelize.pool.size).to.equal(
        1,
        'pool size should be 1 after new connection is acquired',
      );
      expect(cm.validate(firstConnection)).to.be.not.ok;

      newSequelize.pool.release(secondConnection);
    });

    it('should obtain new connection when released connection dies inside pool', async () => {
      const newSequelize = await createSingleTransactionalTestSequelizeInstance(baseSequelize, {
        pool: { max: 1, idle: 5000 },
      });

      const cm = newSequelize.dialect.connectionManager;

      const oldConnection = await newSequelize.pool.acquire();
      newSequelize.pool.release(oldConnection);
      attachMSSQLUniqueId(oldConnection);
      await newSequelize.dialect.connectionManager.disconnect(oldConnection);
      const newConnection = await newSequelize.pool.acquire();

      assertNewConnection(newConnection, oldConnection);
      expect(newSequelize.pool.size).to.equal(1);
      expect(cm.validate(oldConnection)).to.be.not.ok;

      newSequelize.pool.release(newConnection);
    });
  });

  describe('idle', () => {
    it('should maintain connection within idle range', async () => {
      const newSequelize = await createSingleTransactionalTestSequelizeInstance(baseSequelize, {
        pool: { max: 1, idle: 100 },
      });

      const cm = newSequelize.dialect.connectionManager;

      const firstConnection = await newSequelize.pool.acquire();

      attachMSSQLUniqueId(firstConnection);

      // returning connection to the pool
      newSequelize.pool.release(firstConnection);

      // Wait a little and then get next available connection
      await delay(90);
      const secondConnection = await newSequelize.pool.acquire();

      assertSameConnection(secondConnection, firstConnection);
      expect(cm.validate(firstConnection)).to.be.ok;

      newSequelize.pool.release(secondConnection);
    });

    it('should get new connection beyond idle range', async () => {
      const newSequelize = await createSingleTransactionalTestSequelizeInstance(baseSequelize, {
        pool: { max: 1, idle: 100, evict: 10 },
      });

      const pool = newSequelize.pool;
      const cm = newSequelize.dialect.connectionManager;

      const firstConnection = await pool.acquire();

      attachMSSQLUniqueId(firstConnection);

      // returning connection to pool
      pool.release(firstConnection);

      // Wait a little and then get the next available connection
      await delay(150);

      const secondConnection = await pool.acquire();

      assertNewConnection(secondConnection, firstConnection);
      expect(cm.validate(firstConnection)).not.to.be.ok;

      pool.release(secondConnection);
    });
  });

  describe('acquire', () => {
    it('rejects with ConnectionAcquireTimeoutError when unable to acquire connection', async () => {
      const testInstance = new Sequelize({
        dialect: sequelize.rawOptions.dialect,
        databaseVersion: baseSequelize.dialect.minimumDatabaseVersion,
        pool: {
          acquire: 10,
        },
      });

      sandbox
        .stub(testInstance.dialect.connectionManager, 'connect')
        .returns(new Promise(() => {}));

      await expect(testInstance.authenticate()).to.be.rejectedWith(ConnectionAcquireTimeoutError);

      await testInstance.close();
    });
  });
});
