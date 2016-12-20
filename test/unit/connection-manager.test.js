'use strict';

/* jshint -W030 */
var chai = require('chai')
  , sinon = require('sinon')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , Sequelize = require(__dirname + '/../../index')
  , ConnectionManager = require(__dirname + '/../../lib/dialects/abstract/connection-manager')
  , Promise = Sequelize.Promise;

describe('connection manager', function () {
  describe('$connect', function () {
    beforeEach(function () {
      this.sinon = sinon.sandbox.create();
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
      var connection = {};
      this.dialect.connectionManager.connect.returns(Promise.resolve(connection));

      var connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      var config = {};

      return expect(connectionManager.$connect(config)).to.eventually.equal(connection).then(function () {
        expect(this.dialect.connectionManager.connect).to.have.been.calledWith(config);
      }.bind(this));
    });

    it('should let beforeConnect hook modify config', function () {
      var username = Math.random().toString()
        , password = Math.random().toString();

      this.sequelize.beforeConnect(function (config) {
        config.username = username;
        config.password = password;
        return config;
      });

      var connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      return connectionManager.$connect({}).then(function () {
        expect(this.dialect.connectionManager.connect).to.have.been.calledWith({
          username: username,
          password: password
        });
      }.bind(this));
    });

    it('should call afterConnect', function() {
      var spy = sinon.spy();
      this.sequelize.afterConnect(spy);

      var connectionManager = new ConnectionManager(this.dialect, this.sequelize);

      return connectionManager.$connect({}).then(function() {
        expect(spy.callCount).to.equal(1);
        expect(spy.firstCall.args[0]).to.equal(this.connection);
        expect(spy.firstCall.args[1]).to.eql({});
      }.bind(this));
    });
  });
});
