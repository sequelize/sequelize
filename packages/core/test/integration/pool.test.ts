import { expect } from 'chai';
import delay from 'delay';
import type { SinonSandbox } from 'sinon';
import sinon from 'sinon';
import type { Connection } from '@sequelize/core';
import { Sequelize, ConnectionAcquireTimeoutError } from '@sequelize/core';
import {
  createSingleTestSequelizeInstance,
  getTestDialect,
  getTestDialectTeaser,
} from './support';

const dialect = getTestDialect();

function assertSameConnection(newConnection: Connection, oldConnection: Connection) {
  switch (dialect) {
    case 'postgres':
      // @ts-expect-error -- processID not declared yet
      expect(oldConnection.processID).to.equal(newConnection.processID).and.to.be.ok;
      break;

    case 'mariadb':
    case 'mysql':
      // @ts-expect-error -- threadId not declared yet
      expect(oldConnection.threadId).to.equal(newConnection.threadId).and.to.be.ok;
      break;

    case 'db2':
      // @ts-expect-error -- connected not declared yet
      expect(newConnection.connected).to.equal(oldConnection.connected).and.to.be.ok;
      break;

    case 'mssql':
    case 'ibmi':
      // @ts-expect-error -- dummyId not declared yet
      expect(newConnection.dummyId).to.equal(oldConnection.dummyId).and.to.be.ok;
      break;

    default:
      throw new Error('Unsupported dialect');
  }
}

function assertNewConnection(newConnection: Connection, oldConnection: Connection) {
  switch (dialect) {
    case 'postgres':
      // @ts-expect-error -- processID not declared yet
      expect(oldConnection.processID).to.not.be.equal(newConnection.processID);
      break;

    case 'mariadb':
    case 'mysql':
      // @ts-expect-error -- threadId not declared yet
      expect(oldConnection.threadId).to.not.be.equal(newConnection.threadId);
      break;

    case 'db2':
      // @ts-expect-error -- connected not declared yet
      expect(newConnection.connected).to.be.ok;
      // @ts-expect-error -- connected not declared yet
      expect(oldConnection.connected).to.not.be.ok;
      break;

    case 'mssql':
    case 'ibmi':
      // Flaky test
      // @ts-expect-error -- dummyId not declared yet
      expect(newConnection.dummyId).to.not.be.ok;
      // @ts-expect-error -- dummyId not declared yet
      expect(oldConnection.dummyId).to.be.ok;
      break;

    default:
      throw new Error('Unsupported dialect');
  }
}

function attachMSSQLUniqueId(connection: Connection) {
  if (['mssql', 'ibmi'].includes(dialect)) {
    // @ts-expect-error -- dummyId not declared yet
    connection.dummyId = Math.random();
  }

  return connection;
}

let sandbox: SinonSandbox;

beforeEach(() => {
  sandbox = sinon.createSandbox();
});

afterEach(() => {
  sandbox.restore();
});

describe(getTestDialectTeaser('Pooling'), () => {
  if (dialect === 'sqlite' || process.env.DIALECT === 'postgres-native') {
    return;
  }

  describe('network / connection errors', () => {
    it('should obtain new connection when old connection is abruptly closed', async () => {
      async function simulateUnexpectedError(connection: Connection) {
        // should never be returned again
        if (['mssql', 'ibmi'].includes(dialect)) {
          connection = attachMSSQLUniqueId(connection);
        }

        if (dialect === 'db2') {
          await sequelize.connectionManager.pool.destroy(connection);
        } else {
          const error: NodeJS.ErrnoException = new Error('Test ECONNRESET Error');
          error.code = 'ECONNRESET';
          // @ts-expect-error -- emit not declared yet
          connection.emit('error', error);
        }
      }

      const sequelize = createSingleTestSequelizeInstance({
        pool: { max: 1, idle: 5000 },
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const firstConnection = await cm.getConnection();
      await simulateUnexpectedError(firstConnection);
      expect(cm.pool.using).to.eq(0, 'first connection should have errored and not be in use anymore');

      const secondConnection = await cm.getConnection();

      assertNewConnection(secondConnection, firstConnection);
      expect(cm.pool.size).to.equal(1);
      expect(cm.validate(firstConnection)).to.be.not.ok;

      await cm.releaseConnection(secondConnection);
    });

    it('should obtain new connection when released connection dies inside pool', async () => {
      function simulateUnexpectedError(connection: Connection) {
        // should never be returned again
        switch (dialect) {
          case 'mssql': {
            // @ts-expect-error -- close not declared yet
            attachMSSQLUniqueId(connection).close();

            break;
          }

          case 'postgres': {
            // @ts-expect-error -- end not declared yet
            connection.end();

            break;
          }

          case 'db2': {
            // @ts-expect-error -- closeSync not declared yet
            connection.closeSync();

            break;
          }

          default: {
            // @ts-expect-error -- close not declared yet
            connection.close();
          }
        }
      }

      const sequelize = createSingleTestSequelizeInstance({
        pool: { max: 1, idle: 5000 },
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const oldConnection = await cm.getConnection();
      await cm.releaseConnection(oldConnection);
      simulateUnexpectedError(oldConnection);
      const newConnection = await cm.getConnection();

      assertNewConnection(newConnection, oldConnection);
      expect(cm.pool.size).to.equal(1);
      expect(cm.validate(oldConnection)).to.be.not.ok;

      await cm.releaseConnection(newConnection);
    });
  });

  describe('idle', () => {
    it('should maintain connection within idle range', async () => {
      const sequelize = createSingleTestSequelizeInstance({
        pool: { max: 1, idle: 100 },
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const firstConnection = await cm.getConnection();

      // TODO - Do we really need this call?
      attachMSSQLUniqueId(firstConnection);

      // returning connection back to pool
      await cm.releaseConnection(firstConnection);

      // Wait a little and then get next available connection
      await delay(90);
      const secondConnection = await cm.getConnection();

      assertSameConnection(secondConnection, firstConnection);
      expect(cm.validate(firstConnection)).to.be.ok;

      await cm.releaseConnection(secondConnection);
    });

    it('[Flaky] should get new connection beyond idle range', async () => {
      const sequelize = createSingleTestSequelizeInstance({
        pool: { max: 1, idle: 100, evict: 10 },
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const firstConnection = await cm.getConnection();

      // TODO - Do we really need this call?
      attachMSSQLUniqueId(firstConnection);

      // returning connection back to pool
      await cm.releaseConnection(firstConnection);

      // Wait a little and then get next available connection
      await delay(110);

      const secondConnection = await cm.getConnection();

      assertNewConnection(secondConnection, firstConnection);
      expect(cm.validate(firstConnection)).not.to.be.ok;

      await cm.releaseConnection(secondConnection);
    });
  });

  describe('acquire', () => {
    it('should reject with ConnectionAcquireTimeoutError when unable to acquire connection', async () => {
      const testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
        dialect,
        databaseVersion: '1.2.3',
        pool: {
          acquire: 10,
        },
      });

      // @ts-expect-error -- internal method, no typings
      sandbox.stub(testInstance.connectionManager, '_connect')
        .returns(new Promise(() => {}));
      sandbox.stub(testInstance.connectionManager, '_onProcessExit');

      await expect(
        testInstance.authenticate(),
      ).to.eventually.be.rejectedWith(ConnectionAcquireTimeoutError);

      await testInstance.close();
    });

    it('should reject with ConnectionAcquireTimeoutError when unable to acquire connection for transaction', async () => {
      const testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
        dialect,
        databaseVersion: '1.2.3',
        pool: {
          acquire: 10,
          max: 1,
        },
      });

      sandbox.stub(testInstance.connectionManager, '_onProcessExit');

      // @ts-expect-error -- internal method, no typings
      sandbox.stub(testInstance.connectionManager, '_connect')
        .returns(new Promise(() => {}));

      await expect(
        testInstance.transaction(async () => {
          // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- false positive
          await testInstance.transaction<void>(() => {});
        }),
      ).to.eventually.be.rejectedWith(ConnectionAcquireTimeoutError);

      await testInstance.close();
    });
  });
});
