import type { AbstractConnection, Connection } from '@sequelize/core';
import { ConnectionAcquireTimeoutError, Sequelize } from '@sequelize/core';
import type { MsSqlDialect } from '@sequelize/mssql';
import { expect } from 'chai';
import delay from 'delay';
import type { SinonSandbox } from 'sinon';
import sinon from 'sinon';
import { createSingleTestSequelizeInstance, getTestDialect, setResetMode } from './support';

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

    case 'mssql':
    case 'ibmi':
      // @ts-expect-error -- untyped
      expect(newConnection.dummyId).to.equal(oldConnection.dummyId).and.to.be.ok;
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
      // @ts-expect-error -- untyped
      expect(newConnection.dummyId).to.not.be.ok;
      // @ts-expect-error -- untyped
      expect(oldConnection.dummyId).to.be.ok;
      break;

    default:
      throw new Error('Unsupported dialect');
  }
}

function attachMSSQLUniqueId(connection: Connection<MsSqlDialect>) {
  if (['mssql', 'ibmi'].includes(dialectName)) {
    // @ts-expect-error -- dummyId not declared yet
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
      async function simulateUnexpectedError(connection: Connection) {
        // should never be returned again
        if (['mssql', 'ibmi'].includes(dialectName)) {
          connection = attachMSSQLUniqueId(connection);
        }

        if (dialectName === 'db2' || dialectName === 'mariadb') {
          await sequelize.pool.destroy(connection);
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
      expect(cm.pool.using).to.eq(
        0,
        'first connection should have errored and not be in use anymore',
      );

      const secondConnection = await cm.getConnection();

      assertNewConnection(secondConnection, firstConnection);
      expect(cm.pool.size).to.equal(1);
      expect(cm.validate(firstConnection)).to.be.not.ok;

      await cm.releaseConnection(secondConnection);
    });

    it('should obtain new connection when released connection dies inside pool', async () => {
      function simulateUnexpectedError(connection: Connection) {
        // should never be returned again
        switch (dialectName) {
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

    it('should get new connection beyond idle range', async () => {
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
      await delay(150);

      const secondConnection = await cm.getConnection();

      assertNewConnection(secondConnection, firstConnection);
      expect(cm.validate(firstConnection)).not.to.be.ok;

      await cm.releaseConnection(secondConnection);
    });
  });

  describe('acquire', () => {
    it('should reject with ConnectionAcquireTimeoutError when unable to acquire connection', async () => {
      const testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
        dialect: dialectName,
        databaseVersion: '1.2.3',
        pool: {
          acquire: 10,
        },
      });

      // @ts-expect-error -- internal method, no typings
      sandbox.stub(testInstance.connectionManager, '_connect').returns(new Promise(() => {}));
      sandbox.stub(testInstance.connectionManager, '_onProcessExit');

      await expect(testInstance.authenticate()).to.eventually.be.rejectedWith(
        ConnectionAcquireTimeoutError,
      );

      await testInstance.close();
    });

    it('should reject with ConnectionAcquireTimeoutError when unable to acquire connection for transaction', async () => {
      const testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
        dialect: dialectName,
        databaseVersion: '1.2.3',
        pool: {
          acquire: 10,
          max: 1,
        },
      });

      sandbox.stub(testInstance.connectionManager, '_onProcessExit');

      // @ts-expect-error -- internal method, no typings
      sandbox.stub(testInstance.connectionManager, '_connect').returns(new Promise(() => {}));

      await expect(
        testInstance.transaction(async () => {
          await testInstance.transaction<void>(() => {});
        }),
      ).to.eventually.be.rejectedWith(ConnectionAcquireTimeoutError);

      await testInstance.close();
    });
  });
});
