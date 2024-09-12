'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Support = require('./support'),
  ConnectionManager = require('sequelize/lib/dialects/abstract/connection-manager');

describe('connection manager', () => {
  describe('_connect', () => {
    beforeEach(function() {
      this.connection = {};

      this.dialect = {
        connectionManager: {
          connect: sinon.stub().resolves(this.connection)
        }
      };

      this.sequelize = Support.createSequelizeInstance();
    });

    it('should resolve connection on dialect connection manager', async function() {
      const connection = {};
      this.dialect.connectionManager.connect.resolves(connection);

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      const config = {};

      await expect(connectionManager._connect(config)).to.eventually.equal(connection);
      expect(this.dialect.connectionManager.connect).to.have.been.calledWith(config);
    });

    it('should let beforeConnect hook modify config', async function() {
      const username = Math.random().toString(),
        password = Math.random().toString();

      this.sequelize.beforeConnect(config => {
        config.username = username;
        config.password = password;
        return config;
      });

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      await connectionManager._connect({});
      expect(this.dialect.connectionManager.connect).to.have.been.calledWith({
        username,
        password
      });
    });

    it('should call afterConnect', async function() {
      const spy = sinon.spy();
      this.sequelize.afterConnect(spy);

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      await connectionManager._connect({});
      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(this.connection);
      expect(spy.firstCall.args[1]).to.eql({});
    });
  });

  describe('_disconnect', () => {
    beforeEach(function() {
      this.connection = {};

      this.dialect = {
        connectionManager: {
          disconnect: sinon.stub().resolves(this.connection)
        }
      };

      this.sequelize = Support.createSequelizeInstance();
    });

    it('should call beforeDisconnect', async function() {
      const spy = sinon.spy();
      this.sequelize.beforeDisconnect(spy);

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      await connectionManager._disconnect(this.connection);
      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(this.connection);
    });

    it('should call afterDisconnect', async function() {
      const spy = sinon.spy();
      this.sequelize.afterDisconnect(spy);

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      await connectionManager._disconnect(this.connection);
      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(this.connection);
    });
  });
});
