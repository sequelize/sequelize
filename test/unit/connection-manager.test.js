'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Support = require('./support'),
  ConnectionManager = require('../../lib/dialects/abstract/connection-manager');

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

    it('should resolve connection on dialect connection manager', function() {
      const connection = {};
      this.dialect.connectionManager.connect.resolves(connection);

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

    it('should call beforeDisconnect', function() {
      const spy = sinon.spy();
      this.sequelize.beforeDisconnect(spy);

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      return connectionManager._disconnect(this.connection).then(() => {
        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0]).to.equal(this.connection);
      });
    });

    it('should call afterDisconnect', function() {
      const spy = sinon.spy();
      this.sequelize.afterDisconnect(spy);

      const connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      return connectionManager._disconnect(this.connection).then(() => {
        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0]).to.equal(this.connection);
      });
    });
  });
});
