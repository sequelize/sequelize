'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  Sequelize = require(__dirname + '/../../index'),
  ConnectionManager = require(__dirname + '/../../lib/dialects/abstract/connection-manager'),
  Promise = Sequelize.Promise;

describe('connection manager', () => {
  describe('_connect', () => {
    beforeEach(function () {
      this.sinon = sinon.createSandbox();
      this.connection = {};

      this.dialect = {
        connectionManager: {
          connect: this.sinon.stub().returns(Promise.resolve(this.connection))
        }
      };

      this.sequelize = Support.createSequelizeInstance();
    });

    afterEach(function () {
      this.sinon.restore();
    });

    it('should resolve connection on dialect connection manager', function () {
      const connection = {};
      this.dialect.connectionManager.connect.returns(Promise.resolve(connection));

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      const config = {};

      return expect(connectionManager._connect(config))
        .to.eventually.equal(connection)
        .then(() => {
          expect(
            this.dialect.connectionManager.connect.calledWith(config),
            'this.dialect.connectionManager.connect should have been called with expected arguments'
          ).to.be.true;
        });
    });

    it('should let beforeConnect hook modify config', function () {
      const username = Math.random().toString(),
        password = Math.random().toString();

      this.sequelize.beforeConnect((config) => {
        config.username = username;
        config.password = password;
        return config;
      });

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      return connectionManager._connect({}).then(() => {
        expect(
          this.dialect.connectionManager.connect.calledWith({
            username,
            password
          }),
          'this.dialect.connectionManager.connect should have been called with expected arguments'
        ).to.be.true;
      });
    });

    it('should call afterConnect', function () {
      const spy = sinon.spy();
      this.sequelize.afterConnect(spy);

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      return connectionManager._connect({}).then(() => {
        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0]).to.equal(this.connection);
        expect(spy.firstCall.args[1]).to.eql({});
      });
    });
  });

  describe('_checkDatabaseVersion', () => {
    beforeEach(function () {
      this.sinon = sinon.createSandbox();

      this.dialect = {
        connectionManager: {
          connect: this.sinon.stub().returns(Promise.resolve({}))
        }
      };

      this.sequelize = Support.createSequelizeInstance();
      this.sequelize.options.databaseVersion = 0;

      this.connectionManager = new ConnectionManager(this.dialect, this.sequelize);
    });

    afterEach(function () {
      this.sinon.restore();
    });

    // Regression: a transient failure while detecting the database version used to leave the
    // rejected `versionPromise` cached, permanently poisoning every future `getConnection`.
    it('retries version detection after a transient connect failure', function () {
      const cm = this.connectionManager;
      const connectError = new Error('ECONNREFUSED');

      const connectStub = this.sinon.stub(cm, '_connect');
      connectStub.onFirstCall().returns(Promise.reject(connectError));
      connectStub.returns(Promise.resolve({}));

      this.sinon.stub(cm, '_disconnect').returns(Promise.resolve());
      this.sinon.stub(this.sequelize, 'databaseVersion').returns(Promise.resolve('9.6.0'));

      const pooledConnection = {};
      this.sinon.stub(cm.pool, 'acquire').returns(Promise.resolve(pooledConnection));

      // First acquisition fails while detecting the DB version.
      return expect(cm.getConnection())
        .to.be.rejectedWith(connectError)
        .then(() => {
          // The failed detection must not stay cached.
          expect(cm.versionPromise).to.equal(null);

          // The next acquisition retries the connect and succeeds.
          return expect(cm.getConnection()).to.eventually.equal(pooledConnection);
        })
        .then(() => {
          expect(connectStub.calledTwice).to.be.true;
          expect(this.sequelize.options.databaseVersion).to.equal('9.6.0');
        });
    });
  });
});
