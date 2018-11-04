'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Support = require('./support'),
  Sequelize = require('../../index'),
  ConnectionManager = require('../../lib/dialects/abstract/connection-manager'),
  Promise = Sequelize.Promise;

describe('connection manager', () => {
  describe('_connect', () => {
    beforeEach(function() {
      this.sinon = sinon.createSandbox();
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
  });
});
