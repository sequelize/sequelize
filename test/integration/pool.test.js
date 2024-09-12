'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const dialect = Support.getTestDialect();
const sinon = require('sinon');
const Sequelize = Support.Sequelize;
const delay = require('delay');

function assertSameConnection(newConnection, oldConnection) {
  switch (dialect) {
    case 'postgres':
      expect(oldConnection.processID).to.be.equal(newConnection.processID).and.to.be.ok;
      break;

    case 'oracle':
      expect(oldConnection).to.be.equal(newConnection);
      break;

    case 'mariadb':
    case 'mysql':
      expect(oldConnection.threadId).to.be.equal(newConnection.threadId).and.to.be.ok;
      break;

    case 'db2':
      expect(newConnection.connected).to.equal(oldConnection.connected).and.to.be.ok;
      break;

    case 'mssql':
      expect(newConnection.dummyId).to.equal(oldConnection.dummyId).and.to.be.ok;
      break;

    default:
      throw new Error('Unsupported dialect');
  }
}

function assertNewConnection(newConnection, oldConnection) {
  switch (dialect) {
    case 'postgres':
      expect(oldConnection.processID).to.not.be.equal(newConnection.processID);
      break;

    case 'mariadb':
    case 'mysql':
      expect(oldConnection.threadId).to.not.be.equal(newConnection.threadId);
      break;

    case 'db2':
      expect(newConnection.connected).to.be.ok;
      expect(oldConnection.connected).to.not.be.ok;
      break;

    case 'oracle':
      expect(oldConnection).to.not.be.equal(newConnection);
      break;
    
    case 'mssql':
      // Flaky test
      expect(newConnection.dummyId).to.not.be.ok;
      expect(oldConnection.dummyId).to.be.ok;
      break;

    default:
      throw new Error('Unsupported dialect');
  }
}

function attachMSSQLUniqueId(connection) {
  if (dialect === 'mssql') {
    connection.dummyId = Math.random();
  }

  return connection;
}

describe(Support.getTestDialectTeaser('Pooling'), () => {
  if (dialect === 'sqlite' || process.env.DIALECT === 'postgres-native') return;

  beforeEach(function() {
    this.sinon = sinon.createSandbox();
  });

  afterEach(function() {
    this.sinon.restore();
  });

  describe('network / connection errors', () => {
    it('should obtain new connection when old connection is abruptly closed', async () => {
      function simulateUnexpectedError(connection) {
        // should never be returned again
        if (dialect === 'mssql') {
          connection = attachMSSQLUniqueId(connection);
        }
        if (dialect === 'db2') {
          sequelize.connectionManager.pool.destroy(connection);
        } else {
          connection.emit('error', { code: 'ECONNRESET' });
        }
      }

      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 5000 }
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const firstConnection = await cm.getConnection();
      simulateUnexpectedError(firstConnection);
      const secondConnection = await cm.getConnection();

      assertNewConnection(secondConnection, firstConnection);
      expect(cm.pool.size).to.equal(1);
      expect(cm.validate(firstConnection)).to.be.not.ok;

      await cm.releaseConnection(secondConnection);
    });

    it('should obtain new connection when released connection dies inside pool', async () => {
      async function simulateUnexpectedError(connection) {
        // should never be returned again
        if (dialect === 'mssql') {
          attachMSSQLUniqueId(connection).close();
        } else if (dialect === 'postgres') {
          connection.end();
        } else if (dialect === 'db2') {
          connection.closeSync();
        } else if (dialect === 'oracle') {
          // For the Oracle dialect close is an async function
          await connection.close();
        } else {
          connection.close();
        }
      }

      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 5000 }
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const oldConnection = await cm.getConnection();
      await cm.releaseConnection(oldConnection);
      await simulateUnexpectedError(oldConnection);
      const newConnection = await cm.getConnection();

      assertNewConnection(newConnection, oldConnection);
      expect(cm.pool.size).to.equal(1);
      expect(cm.validate(oldConnection)).to.be.not.ok;

      await cm.releaseConnection(newConnection);
    });
  });

  describe('idle', () => {
    it('should maintain connection within idle range', async () => {
      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 100 }
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

    it('[MSSQL Flaky] should get new connection beyond idle range', async () => {
      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 100, evict: 10 }
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
    it('should reject with ConnectionAcquireTimeoutError when unable to acquire connection', async function() {
      this.testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
        dialect,
        databaseVersion: '1.2.3',
        pool: {
          acquire: 10
        }
      });

      this.sinon.stub(this.testInstance.connectionManager, '_connect')
        .returns(new Promise(() => {}));

      await expect(
        this.testInstance.authenticate()
      ).to.eventually.be.rejectedWith(Sequelize.ConnectionAcquireTimeoutError);
    });

    it('should reject with ConnectionAcquireTimeoutError when unable to acquire connection for transaction', async function() {
      this.testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
        dialect,
        databaseVersion: '1.2.3',
        pool: {
          acquire: 10,
          max: 1
        }
      });

      this.sinon.stub(this.testInstance.connectionManager, '_connect')
        .returns(new Promise(() => {}));

      await expect(
        this.testInstance.transaction(async () => {
          await this.testInstance.transaction(() => {});
        })
      ).to.eventually.be.rejectedWith(Sequelize.ConnectionAcquireTimeoutError);
    });
  });
});
