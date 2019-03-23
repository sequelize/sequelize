'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const sinon = require('sinon');
const Config = require('../../../config/config');
const ConnectionManager = require('../../../../lib/dialects/abstract/connection-manager');
const Pool = require('sequelize-pool').Pool;

const baseConf = Config[Support.getTestDialect()];
const poolEntry = {
  host: baseConf.host,
  port: baseConf.port,
  pool: {}
};

describe('Connection Manager', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.usingPromise(require('bluebird'));
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

    connectionManager.initPools();
    expect(connectionManager.pool).to.be.instanceOf(Pool);
    expect(connectionManager.pool.read).to.be.undefined;
    expect(connectionManager.pool.write).to.be.undefined;
  });

  it('should initialize a multiple pools with replication', () => {
    const options = {
      replication: {
        write: { ...poolEntry },
        read: [{ ...poolEntry }, { ...poolEntry }]
      }
    };
    const sequelize = Support.createSequelizeInstance(options);
    const connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    connectionManager.initPools();
    expect(connectionManager.pool.read).to.be.instanceOf(Pool);
    expect(connectionManager.pool.write).to.be.instanceOf(Pool);
  });

  it('should round robin calls to the read pool', () => {
    if (Support.getTestDialect() === 'sqlite') {
      return;
    }

    const slave1 = { ...poolEntry };
    const slave2 = { ...poolEntry };
    slave1.host = 'slave1';
    slave2.host = 'slave2';

    const options = {
      replication: {
        write: { ...poolEntry },
        read: [slave1, slave2]
      }
    };
    const sequelize = Support.createSequelizeInstance(options);
    const connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    const res = {
      queryType: 'read'
    };

    const connectStub = sandbox.stub(connectionManager, '_connect').resolves(res);
    sandbox.stub(connectionManager, '_disconnect').resolves(res);
    sandbox.stub(sequelize, 'databaseVersion').resolves(res);
    connectionManager.initPools();

    const queryOptions = {
      priority: 0,
      type: 'SELECT',
      useMaster: false
    };

    const _getConnection = connectionManager.getConnection.bind(connectionManager, queryOptions);

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
    const master = { ...poolEntry };
    master.host = 'the-boss';

    const options = {
      replication: {
        write: master,
        read: [{ ...poolEntry }]
      }
    };
    const sequelize = Support.createSequelizeInstance(options);
    const connectionManager = new ConnectionManager(Support.getTestDialect(), sequelize);

    const res = {
      queryType: 'read'
    };
    const connectStub = sandbox.stub(connectionManager, '_connect').resolves(res);
    sandbox.stub(connectionManager, '_disconnect').resolves(res);
    sandbox.stub(sequelize, 'databaseVersion').resolves(res);
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
    const poolClearSpy = sandbox.spy(connectionManager.pool, 'destroyAllNow');

    return connectionManager.close().then(() => {
      expect(poolDrainSpy.calledOnce).to.be.true;
      expect(poolClearSpy.calledOnce).to.be.true;
    });
  });

});
