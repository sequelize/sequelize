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
    beforeEach(function() {
      this.sinon = sinon.sandbox.create();
      this.connection = {};

      this.dialect = {
        connectionManager: {
          connect: this.sinon.stub().returns(Promise.resolve(this.connection))
        }
      };

      this.sequelize = Support.createSequelizeInstance();
    });

    afterEach(function() {
      this.sinon.restore();
    });

    it('should resolve connection on dialect connection manager', function() {
      const connection = {};
      this.dialect.connectionManager.connect.returns(Promise.resolve(connection));

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      const config = {};

      return expect(connectionManager._connect(config)).to.eventually.equal(connection).then(() => {
        expect(this.dialect.connectionManager.connect).to.have.been.calledWith(config);
      });
    });

    it('should let beforeConnect hook modify config', function() {
      const username = Math.random().toString(),
        password = Math.random().toString();

      this.sequelize.beforeConnect(config => {
        config.username = username;
        config.password = password;
        return config;
      });

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      return connectionManager._connect({}).then(() => {
        expect(this.dialect.connectionManager.connect).to.have.been.calledWith({
          username,
          password
        });
      });
    });

    it('should call afterConnect', function() {
      const spy = sinon.spy();
      this.sequelize.afterConnect(spy);

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      return connectionManager._connect({}).then(() => {
        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0]).to.equal(this.connection);
        expect(spy.firstCall.args[1]).to.eql({});
      });
    });

    describe('After acquire connection hook', () => {
      it('should run afterPoolAcquire hook', function() {

        // bypass retriving database version wich requires an actual connection.
        this.sequelize.options.databaseVersion = -1;

        const spy = sinon.spy();

        this.sequelize.addHook('afterPoolAcquire', connection => {
          return new Promise(resolve => {
            spy(connection); 
            resolve();
          });
        });

        const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

        return connectionManager.getConnection().then( connection => {
          expect(spy.callCount).to.equal(1);
          expect(connection).to.equal(this.connection);
          expect(spy.firstCall.args[0]).to.equal(this.connection);
        });

      });
    });

    describe('Before release beforePoolRelease hook', () => {
      it('should run beforePoolRelease hook', function() {

        // bypass retriving database version wich requires an actual connection.
        this.sequelize.options.databaseVersion = -1;

        const spy = sinon.spy();

        this.sequelize.addHook('beforePoolRelease', connection => {
          return new Promise(resolve => {
            spy(connection); 
            resolve(connection);
          });
        });

        const connectionManager = new ConnectionManager(this.dialect, this.sequelize);
        return connectionManager.releaseConnection(this.connection).then(() => {
          expect(spy.callCount).to.equal(1);
          expect(spy.firstCall.args[0]).to.equal(this.connection);
        });

      });
    });
  });
});
