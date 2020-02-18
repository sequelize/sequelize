'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const dialect = Support.getTestDialect();
const sinon = require('sinon');
const Sequelize = Support.Sequelize;

function assertSameConnection(newConnection, oldConnection) {
  switch (dialect) {
    case 'postgres':
      expect(oldConnection.processID).to.be.equal(newConnection.processID).and.to.be.ok;
      break;

    case 'mariadb':
    case 'mysql':
      expect(oldConnection.threadId).to.be.equal(newConnection.threadId).and.to.be.ok;
      break;

    case 'mssql':
      expect(newConnection.unwrap().dummyId).to.equal(oldConnection.unwrap().dummyId).and.to.be.ok;
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

    case 'mssql':
      expect(newConnection.unwrap().dummyId).to.not.be.ok;
      expect(oldConnection.unwrap().dummyId).to.be.ok;
      break;

    default:
      throw new Error('Unsupported dialect');
  }
}

function unwrapAndAttachMSSQLUniqueId(connection) {
  if (dialect === 'mssql') {
    connection = connection.unwrap();
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
          connection = unwrapAndAttachMSSQLUniqueId(connection);
        }
        connection.emit('error', { code: 'ECONNRESET' });
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
      function simulateUnexpectedError(connection) {
        // should never be returned again
        if (dialect === 'mssql') {
          unwrapAndAttachMSSQLUniqueId(connection).close();
        } else if (dialect === 'postgres') {
          connection.end();
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
      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 100 }
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const firstConnection = await cm.getConnection();

      // TODO - Do we really need this call?
      unwrapAndAttachMSSQLUniqueId(firstConnection);

      // returning connection back to pool
      await cm.releaseConnection(firstConnection);

      // Wait a little and then get next available connection
      await Sequelize.Promise.delay(90);
      const secondConnection = await cm.getConnection();

      assertSameConnection(secondConnection, firstConnection);
      expect(cm.validate(firstConnection)).to.be.ok;

      await cm.releaseConnection(secondConnection);
    });

    it('should get new connection beyond idle range', async () => {
      const sequelize = Support.createSequelizeInstance({
        pool: { max: 1, idle: 100, evict: 10 }
      });
      const cm = sequelize.connectionManager;
      await sequelize.sync();

      const firstConnection = await cm.getConnection();

      // TODO - Do we really need this call?
      unwrapAndAttachMSSQLUniqueId(firstConnection);

      // returning connection back to pool
      await cm.releaseConnection(firstConnection);

      // Wait a little and then get next available connection
      await Sequelize.Promise.delay(110);

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
        .returns(new Sequelize.Promise(() => {}));

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
        .returns(new Sequelize.Promise(() => {}));

      await expect(
        this.testInstance.transaction(async () => {
          await this.testInstance.transaction(() => {});
        })
      ).to.eventually.be.rejectedWith(Sequelize.ConnectionAcquireTimeoutError);
    });
  });
});
