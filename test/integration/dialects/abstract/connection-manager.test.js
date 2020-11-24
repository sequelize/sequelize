'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  sinon = require('sinon'),
  Config = require(__dirname + '/../../../config/config'),
  ConnectionManager = require(__dirname + '/../../../../lib/dialects/abstract/connection-manager'),
  Pooling = require('generic-pool'),
  _ = require('lodash'),
  Promise = require(__dirname + '/../../../../lib/promise');

const baseConf = Config[Support.getTestDialect()];
const poolEntry = {
  host: baseConf.host,
  port: baseConf.port,
  pool: {}
};

describe('Connection Manager', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should initialize a single pool without replication', () => {
    const options = {
      replication: null
    };
    const sequelize = Support.createSequelizeInstance(options);
    const connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    const poolSpy = sandbox.spy(Pooling, 'createPool');
    connectionManager.initPools();
    expect(poolSpy.calledOnce).to.be.true;
  });

  it('should initialize a multiple pools with replication', () => {
    const options = {
      replication: {
        write: _.clone(poolEntry),
        read: [_.clone(poolEntry), _.clone(poolEntry)]
      }
    };
    const sequelize = Support.createSequelizeInstance(options);
    const connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    const poolSpy = sandbox.spy(Pooling, 'createPool');
    connectionManager.initPools();
    expect(poolSpy.calledTwice).to.be.true;
  });

  it('should round robin calls to the read pool', () => {
    if (Support.getTestDialect() === 'sqlite') {
      return;
    }

    const slave1 = _.clone(poolEntry);
    const slave2 = _.clone(poolEntry);
    slave1.host = 'slave1';
    slave2.host = 'slave2';

    const options = {
      replication: {
        write: _.clone(poolEntry),
        read: [slave1, slave2]
      }
    };
    const sequelize = Support.createSequelizeInstance(options);
    const connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    const resolvedPromise = new Promise(resolve => {
      resolve({
        queryType: 'read'
      });
    });

    const connectStub = sandbox.stub(connectionManager, '_connect').returns(resolvedPromise);
    sandbox.stub(connectionManager, '_disconnect').returns(resolvedPromise);
    sandbox.stub(sequelize, 'databaseVersion').returns(resolvedPromise);
    connectionManager.initPools();

    const queryOptions = {
      priority: 0,
      type: 'SELECT',
      useMaster: false
    };

    const _getConnection = _.bind(connectionManager.getConnection, connectionManager, queryOptions);

    return _getConnection()
      .then(_getConnection)
      .then(_getConnection)
      .then(() => {
        chai.expect(connectStub.callCount).to.equal(4);

        // First call is the get connection for DB versions - ignore
        const calls = connectStub.getCalls();
        chai.expect(calls[1].args[0].host).to.eql('slave1');
        chai.expect(calls[2].args[0].host).to.eql('slave2');
        chai.expect(calls[3].args[0].host).to.eql('slave1');
      });
  });

  it('should allow forced reads from the write pool', () => {
    const master = _.clone(poolEntry);
    master.host = 'the-boss';

    const options = {
      replication: {
        write: master,
        read: [_.clone(poolEntry)]
      }
    };
    const sequelize = Support.createSequelizeInstance(options);
    const connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    const resolvedPromise = new Promise(resolve => {
      resolve({
        queryType: 'read'
      });
    });

    const connectStub = sandbox.stub(connectionManager, '_connect').returns(resolvedPromise);
    sandbox.stub(connectionManager, '_disconnect').returns(resolvedPromise);
    sandbox.stub(sequelize, 'databaseVersion').returns(resolvedPromise);
    connectionManager.initPools();

    const queryOptions = {
      priority: 0,
      type: 'SELECT',
      useMaster: true
    };

    return connectionManager.getConnection(queryOptions)
      .then(() => {
        chai.expect(connectStub).to.have.been.calledTwice; // Once to get DB version, and once to actually get the connection.
        const calls = connectStub.getCalls();
        chai.expect(calls[1].args[0].host).to.eql('the-boss');
      });
  });

  it('should clear the pool after draining it', () => {
    const options = {
      replication: null
    };
    const sequelize = Support.createSequelizeInstance(options);
    const connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    connectionManager.initPools();

    const poolDrainSpy = sandbox.spy(connectionManager.pool, 'drain');
    const poolClearSpy = sandbox.spy(connectionManager.pool, 'clear');

    return connectionManager.close().then(() => {
      expect(poolDrainSpy.calledOnce).to.be.true;
      expect(poolClearSpy.calledOnce).to.be.true;
    });
  });

});
