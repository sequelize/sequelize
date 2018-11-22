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
};

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
};

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
    it('should obtain new connection when old connection is abruptly closed', () => {
      const sequelize = Support.createSequelizeInstance({
        pool: {
          max: 1,
          idle: 5000
        }
      });

      const cm = sequelize.connectionManager;
      let conn;

      return sequelize
        .sync()
        .then(() => cm.getConnection())
        .then(connection => {
          // Save current connection
          conn = connection;

          if (dialect === 'mssql') {
            connection = unwrapAndAttachMSSQLUniqueId(connection);
          }

          // simulate an unexpected error
          // should never be returned again
          connection.emit('error', {
            code: 'ECONNRESET'
          });
        })
        .then(() => {
          // Get next available connection
          return cm.getConnection();
        })
        .then(connection => {
          assertNewConnection(connection, conn);

          expect(sequelize.connectionManager.pool.size).to.equal(1);
          expect(cm.validate(conn)).to.be.not.ok;

          return cm.releaseConnection(connection);
        });
    });

    it('should obtain new connection when released connection dies inside pool', () => {
      const sequelize = Support.createSequelizeInstance({
        pool: {
          max: 1,
          idle: 5000
        }
      });

      const cm = sequelize.connectionManager;
      let oldConnection;

      return sequelize
        .sync()
        .then(() => cm.getConnection())
        .then(connection => {
          // Save current connection
          oldConnection = connection;

          return cm.releaseConnection(connection);
        })
        .then(() => {
          let connection = oldConnection;

          if (dialect === 'mssql') {
            connection = unwrapAndAttachMSSQLUniqueId(connection);
          }

          // simulate an unexpected error
          // should never be returned again
          if (dialect.match(/postgres/)) {
            connection.end();
          } else {
            connection.close();
          }
        })
        .then(() => {
          // Get next available connection
          return cm.getConnection();
        })
        .then(connection => {
          assertNewConnection(connection, oldConnection);

          expect(sequelize.connectionManager.pool.size).to.equal(1);
          expect(cm.validate(oldConnection)).to.be.not.ok;

          return cm.releaseConnection(connection);
        });
    });
  });

  describe('idle', () => {
    it('should maintain connection within idle range', () => {
      const sequelize = Support.createSequelizeInstance({
        pool: {
          max: 1,
          idle: 10
        }
      });

      const cm = sequelize.connectionManager;
      let conn;

      return sequelize.sync()
        .then(() => cm.getConnection())
        .then(connection => {
          // Save current connection
          conn = connection;

          if (dialect === 'mssql') {
            connection = unwrapAndAttachMSSQLUniqueId(connection);
          }

          // returning connection back to pool
          return cm.releaseConnection(conn);
        })
        .then(() => {
          // Get next available connection
          return Sequelize.Promise.delay(9).then(() => cm.getConnection());
        })
        .then(connection => {
          assertSameConnection(connection, conn);
          expect(cm.validate(conn)).to.be.ok;

          return cm.releaseConnection(connection);
        });
    });

    it('should get new connection beyond idle range', () => {
      const sequelize = Support.createSequelizeInstance({
        pool: {
          max: 1,
          idle: 100,
          evict: 10
        }
      });

      const cm = sequelize.connectionManager;
      let conn;

      return sequelize.sync()
        .then(() => cm.getConnection())
        .then(connection => {
          // Save current connection
          conn = connection;

          if (dialect === 'mssql') {
            connection = unwrapAndAttachMSSQLUniqueId(connection);
          }

          // returning connection back to pool
          return cm.releaseConnection(conn);
        })
        .then(() => {
          // Get next available connection
          return Sequelize.Promise.delay(110).then(() => cm.getConnection());
        })
        .then(connection => {
          assertNewConnection(connection, conn);
          expect(cm.validate(conn)).not.to.be.ok;

          return cm.releaseConnection(connection);
        });
    });
  });

  describe('acquire', () => {
    it('should reject with ConnectionAcquireTimeoutError when unable to acquire connection', function() {
      this.testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
        dialect,
        databaseVersion: '1.2.3',
        pool: {
          acquire: 10
        }
      });

      this.sinon.stub(this.testInstance.connectionManager, '_connect')
        .returns(new Sequelize.Promise(() => {}));

      return expect(this.testInstance.authenticate())
        .to.eventually.be.rejectedWith(Sequelize.ConnectionAcquireTimeoutError);
    });

    it('should reject with ConnectionAcquireTimeoutError when unable to acquire connection for transaction', function() {
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

      return expect(this.testInstance.transaction(() => {
        return this.testInstance.transaction(() => {});
      })).to.eventually.be.rejectedWith(Sequelize.ConnectionAcquireTimeoutError);
    });
  });
});
