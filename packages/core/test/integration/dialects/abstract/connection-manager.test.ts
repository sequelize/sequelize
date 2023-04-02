import chai from 'chai';
import { Pool } from 'sequelize-pool';
import type { SinonSandbox } from 'sinon';
import sinon from 'sinon';
import type { Connection } from '@sequelize/core';
import type { GetConnectionOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/connection-manager.js';
import { ReplicationPool } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/replication-pool.js';
import { Config } from '../../../config/config';
import {
  getTestDialect,
  getTestDialectTeaser,
  createSingleTestSequelizeInstance, setResetMode, createSequelizeInstance,
} from '../../support';

const expect = chai.expect;
const baseConf = Config[getTestDialect()];
const poolEntry = {
  host: baseConf.host,
  port: baseConf.port,
  pool: {},
};

const dialect = getTestDialect();

describe(getTestDialectTeaser('Connection Manager'), () => {
  setResetMode('none');

  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('does not initialize a readOnly pool without replication', () => {
    const options = {
      replication: null,
    };

    const sequelize = createSingleTestSequelizeInstance(options);
    expect(sequelize.connectionManager.pool).to.be.instanceOf(ReplicationPool);
    expect(sequelize.connectionManager.pool.read).to.be.null;
    expect(sequelize.connectionManager.pool.write).to.be.instanceOf(Pool);
  });

  it('initializes a readOnly pool with replication', () => {
    const options = {
      replication: {
        write: { ...poolEntry },
        read: [{ ...poolEntry }, { ...poolEntry }],
      },
    };

    const sequelize = createSingleTestSequelizeInstance(options);
    expect(sequelize.connectionManager.pool).to.be.instanceOf(ReplicationPool);
    expect(sequelize.connectionManager.pool.read).to.be.instanceOf(Pool);
    expect(sequelize.connectionManager.pool.write).to.be.instanceOf(Pool);
  });

  it('should round robin calls to the read pool', async () => {
    if (getTestDialect() === 'sqlite') {
      return;
    }

    const replica1 = { ...poolEntry, host: 'replica1' };
    const replica2 = { ...poolEntry, host: 'replica2' };

    const options = {
      replication: {
        write: { ...poolEntry },
        read: [replica1, replica2],
      },
    };

    const sequelize = createSingleTestSequelizeInstance(options);
    const connectionManager = sequelize.connectionManager;

    const res: Connection = {};

    // @ts-expect-error -- internal method, no typings
    const connectStub = sandbox.stub(connectionManager, '_connect').resolves(res);
    // @ts-expect-error -- internal method, no typings
    sandbox.stub(connectionManager, '_disconnect').resolves();
    sandbox.stub(connectionManager, '_onProcessExit');
    sandbox.stub(sequelize, 'fetchDatabaseVersion').resolves(sequelize.dialect.defaultVersion);

    const queryOptions: GetConnectionOptions = {
      type: 'read',
      useMaster: false,
    };

    const _getConnection = connectionManager.getConnection.bind(
      connectionManager,
      queryOptions,
    );

    await _getConnection();
    await _getConnection();
    await _getConnection();
    chai.expect(connectStub.callCount).to.equal(4);

    // First call is the get connection for DB versions - ignore
    const calls = connectStub.getCalls();
    chai.expect(calls[1].args[0].host).to.eql('replica1');
    chai.expect(calls[2].args[0].host).to.eql('replica2');
    chai.expect(calls[3].args[0].host).to.eql('replica1');

    await sequelize.close();
  });

  // sqlite does not have different database versions since it's bundled
  if (dialect !== 'sqlite') {
    it('should trigger deprecation for non supported engine version', async () => {
      const stub = sandbox.stub(process, 'emitWarning');
      const sequelize = createSequelizeInstance();
      const connectionManager = sequelize.connectionManager;

      sandbox.stub(sequelize, 'fetchDatabaseVersion').resolves('0.0.1');

      const res: Connection = {};

      // @ts-expect-error -- internal method, no typings
      sandbox.stub(connectionManager, '_connect').resolves(res);
      // @ts-expect-error -- internal method, no typings
      sandbox.stub(connectionManager, '_disconnect').resolves();
      sandbox.stub(connectionManager, '_onProcessExit');

      const queryOptions: GetConnectionOptions = {
        type: 'read',
        useMaster: true,
      };

      await connectionManager.getConnection(queryOptions);
      chai.expect(stub).to.have.been.calledOnce;
      chai
        .expect(stub.getCalls()[0].args[0])
        .to.contain(
          'This database engine version is not supported, please update your database server.',
        );
      stub.restore();

      await sequelize.close();
    });
  }

  if (dialect !== 'sqlite') {
    // sqlite overrides getConnection() and never uses _connect
    it('should allow forced reads from the write pool', async () => {
      const main = { ...poolEntry };
      main.host = 'the-boss';

      const options = {
        replication: {
          write: main,
          read: [{ ...poolEntry }],
        },
      };
      const sequelize = createSequelizeInstance(options);
      const connectionManager = sequelize.connectionManager;

      const res: Connection = {};

      const connectStub = sandbox
        // @ts-expect-error -- internal method, no typings
        .stub(connectionManager, '_connect')
        .resolves(res);

      // @ts-expect-error -- internal method, no typings
      sandbox.stub(connectionManager, '_disconnect').resolves();
      sandbox.stub(connectionManager, '_onProcessExit');

      sandbox
        .stub(sequelize, 'fetchDatabaseVersion')
        .resolves(sequelize.dialect.defaultVersion);

      const queryOptions: GetConnectionOptions = {
        type: 'read',
        useMaster: true,
      };

      await connectionManager.getConnection(queryOptions);
      chai.expect(connectStub).to.have.been.calledTwice; // Once to get DB version, and once to actually get the connection.
      const calls = connectStub.getCalls();
      chai.expect(calls[1].args[0].host).to.eql('the-boss');

      await sequelize.close();
    });
  }

  it('should clear the pool after draining it', async () => {
    const options = {
      replication: null,
    };
    const sequelize = createSingleTestSequelizeInstance(options);
    const connectionManager = sequelize.connectionManager;

    const poolDrainSpy = sandbox.spy(connectionManager.pool, 'drain');
    const poolClearSpy = sandbox.spy(connectionManager.pool, 'destroyAllNow');

    await connectionManager.close();
    expect(poolDrainSpy.calledOnce).to.be.true;
    expect(poolClearSpy.calledOnce).to.be.true;
  });
});
