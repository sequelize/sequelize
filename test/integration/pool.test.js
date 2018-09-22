'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const dialect = Support.getTestDialect();
const sinon = require('sinon');
const Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Pooling'), function() {
  if (dialect === 'sqlite') return;

  beforeEach(() => {
    this.sinon = sinon.createSandbox();
  });

  afterEach(() => {
    this.sinon.restore();
  });

  it('should obtain new connection when old connection is abruptly closed', () => {
    const sequelize = Support.createSequelizeInstance({
      pool: {
        max: 1,
        min: 1,
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
          connection = connection.unwrap();
          connection.dummyId = Math.random();
        }

        // simulate a unexpected error
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
        switch (dialect) {
          case 'postgres':
          case 'postges-native':
            expect(conn.processID).to.not.be.equal(connection.processID);
            break;

          case 'mysql':
            expect(conn.threadId).to.not.be.equal(connection.threadId);
            break;

          case 'mssql':
            expect(connection.unwrap().dummyId).to.not.be.ok;
            expect(conn.unwrap().dummyId).to.be.ok;
            break;

          default:
            throw new Error('Unsupported dialect');
        }

        // Old threadId should be different from current new one
        expect(sequelize.connectionManager.pool.size).to.equal(1);
        expect(cm.validate(conn)).to.be.not.ok;

        return cm.releaseConnection(connection);
      });
  });

  it('should obtain new connection when released connection dies inside pool', () => {
    const sequelize = Support.createSequelizeInstance({
      pool: {
        max: 1,
        min: 1,
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
          connection = oldConnection.unwrap();
          connection.dummyId = Math.random();
        }

        // simulate a unexpected error
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
        switch (dialect) {
          case 'postgres':
          case 'postges-native':
            expect(oldConnection.processID).to.not.be.equal(connection.processID);
            break;

          case 'mysql':
            expect(oldConnection.threadId).to.not.be.equal(connection.threadId);
            break;

          case 'mssql':
            expect(connection.unwrap().dummyId).to.not.be.ok;
            expect(oldConnection.unwrap().dummyId).to.be.ok;
            break;

          default:
            throw new Error('Unsupported dialect');
        }

        // Old threadId should be different from current new one
        expect(sequelize.connectionManager.pool.size).to.equal(1);
        expect(cm.validate(oldConnection)).to.be.not.ok;

        return cm.releaseConnection(connection);
      });
  });

  it('should maintain connection within idle range', () => {
    const sequelize = Support.createSequelizeInstance({
      pool: {
        min: 1,
        max: 1,
        idle: 5000
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
          connection = connection.unwrap();
          connection.dummyId = Math.random();
        }

        // returning connection back to pool
        return cm.releaseConnection(conn);
      })
      .then(() => {
        // Get next available connection
        return cm.getConnection();
      })
      .then(connection => {
        // Old threadId should be same as current connection
        switch (dialect) {
          case 'postgres':
          case 'postges-native':
            expect(conn.processID).to.be.equal(connection.processID).and.to.be.ok;
            break;

          case 'mysql':
            expect(conn.threadId).to.be.equal(connection.threadId).and.to.be.ok;
            break;

          case 'mssql':
            expect(connection.unwrap().dummyId).to.be.ok;
            expect(conn.unwrap().dummyId).to.be.ok;
            break;

          default:
            throw new Error('Unsupported dialect');
        }

        expect(cm.validate(conn)).to.be.ok;

        return cm.releaseConnection(connection);
      });
  });

  describe('acquire', () => {
    it('should reject with ConnectionAcquireTimeoutError when unable to acquire connection in given time', () => {
      this.testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
        dialect,
        databaseVersion: '1.2.3',
        pool: {
          acquire: 1000 //milliseconds
        }
      });

      this.sinon.stub(this.testInstance.connectionManager, '_connect')
        .returns(new Sequelize.Promise(() => {}));

      return expect(this.testInstance.authenticate())
        .to.eventually.be.rejectedWith(Sequelize.ConnectionAcquireTimeoutError);
    });

    it('should not result in unhandled promise rejection when unable to acquire connection', () => {
      this.testInstance = new Sequelize('localhost', 'ffd', 'dfdf', {
        dialect,
        databaseVersion: '1.2.3',
        pool: {
          acquire: 1000,
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
