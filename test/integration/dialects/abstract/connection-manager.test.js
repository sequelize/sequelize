'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , sinon = require('sinon')
  , Config = require(__dirname + '/../../../config/config')
  , ConnectionManager = require(__dirname + '/../../../../lib/dialects/abstract/connection-manager')
  , Pooling = require('generic-pool')
  , _ = require('lodash')
  , Promise = require(__dirname + '/../../../../lib/promise');

var baseConf = Config[Support.getTestDialect()];
var poolEntry = {
  host: baseConf.host,
  port: baseConf.port,
  pool: {}
};

describe('Connection Manager', function() {

  var sandbox;

  beforeEach(function(){
    sandbox = sinon.sandbox.create();
  });

  afterEach(function(){
    sandbox.restore();
  });

  it('should initialize a single pool without replication', function() {
    var options = {
      replication: null
    };
    var sequelize = Support.createSequelizeInstance(options);
    var connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    var poolSpy = sandbox.spy(Pooling, 'createPool');
    connectionManager.initPools();
    expect(poolSpy.calledOnce).to.be.true;
  });

  it('should initialize a multiple pools with replication', function() {
    var options = {
      replication: {
        write: _.clone(poolEntry),
        read: [_.clone(poolEntry), _.clone(poolEntry)]
      }
    };
    var sequelize = Support.createSequelizeInstance(options);
    var connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    var poolSpy = sandbox.spy(Pooling, 'createPool');
    connectionManager.initPools();
    expect(poolSpy.calledTwice).to.be.true;
  });

  it('should round robin calls to the read pool', function() {
    if (Support.getTestDialect() === 'sqlite') {
      return;
    }

    var slave1 = _.clone(poolEntry);
    var slave2 = _.clone(poolEntry);
    slave1.host = 'slave1';
    slave2.host = 'slave2';

    var options = {
      replication: {
        write: _.clone(poolEntry),
        read: [slave1, slave2]
      }
    };
    var sequelize = Support.createSequelizeInstance(options);
    var connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    var resolvedPromise = new Promise(function(resolve) {
      resolve({
        queryType: 'read'
      });
    });

    var connectStub = sandbox.stub(connectionManager, '_connect').returns(resolvedPromise);
    sandbox.stub(connectionManager, '_disconnect').returns(resolvedPromise);
    sandbox.stub(sequelize, 'databaseVersion').returns(resolvedPromise);
    connectionManager.initPools();

    var queryOptions = {
      priority: 0,
      type: 'SELECT',
      useMaster: false
    };

    var _getConnection = _.bind(connectionManager.getConnection, connectionManager, queryOptions);

    return _getConnection()
      .then(_getConnection)
      .then(_getConnection)
      .then(function checkPoolHosts() {
        chai.expect(connectStub.callCount).to.equal(4);

        // First call is the get connection for DB versions - ignore
        var calls = connectStub.getCalls();
        chai.expect(calls[1].args[0].host).to.eql('slave1');
        chai.expect(calls[2].args[0].host).to.eql('slave2');
        chai.expect(calls[3].args[0].host).to.eql('slave1');
      });
  });

  it('should allow forced reads from the write pool', function() {
    var master = _.clone(poolEntry);
    master.host = 'the-boss';

    var options = {
      replication: {
        write: master,
        read: [_.clone(poolEntry)]
      }
    };
    var sequelize = Support.createSequelizeInstance(options);
    var connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    var resolvedPromise = new Promise(function(resolve) {
      resolve({
        queryType: 'read'
      });
    });

    var connectStub = sandbox.stub(connectionManager, '_connect').returns(resolvedPromise);
    sandbox.stub(connectionManager, '_disconnect').returns(resolvedPromise);
    sandbox.stub(sequelize, 'databaseVersion').returns(resolvedPromise);
    connectionManager.initPools();

    var queryOptions = {
      priority: 0,
      type: 'SELECT',
      useMaster: true
    };

    return connectionManager.getConnection(queryOptions)
      .then(function checkPoolHosts() {
        chai.expect(connectStub).to.have.been.calledTwice; // Once to get DB version, and once to actually get the connection.
        var calls = connectStub.getCalls();
        chai.expect(calls[1].args[0].host).to.eql('the-boss');
      });
  });

});
