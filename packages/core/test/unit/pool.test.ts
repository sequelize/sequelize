import type { AbstractConnection, AbstractDialect, Sequelize } from '@sequelize/core';
import { ReplicationPool } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/replication-pool.js';
import type { PostgresDialect } from '@sequelize/postgres';
import { expect } from 'chai';
import { Pool } from 'sequelize-pool';
import type { SinonSandbox, SinonStub } from 'sinon';
import sinon from 'sinon';
import type { DialectConnectionConfigs } from '../config/config';
import {
  createSequelizeInstance,
  getSqliteDatabasePath,
  getTestDialect,
  sequelize,
} from '../support';

const dialectName = getTestDialect();

describe('sequelize.pool', () => {
  describe('init', () => {
    let sandbox: SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('does not initialize a readOnly pool without replication', () => {
      const sequelize2 = createSequelizeInstance({
        replication: null,
      });

      expect(sequelize2.pool).to.be.instanceOf(ReplicationPool);
      expect(sequelize2.pool.read).to.be.null;
      expect(sequelize2.pool.write).to.be.instanceOf(Pool);
    });

    it('initializes a readOnly pool with replication', () => {
      const connectionOptions = sequelize.options.replication.write;

      const sequelize2 = createSequelizeInstance<AbstractDialect>({
        replication: {
          write: connectionOptions,
          read: [connectionOptions, connectionOptions],
        },
      });

      expect(sequelize2.pool).to.be.instanceOf(ReplicationPool);
      expect(sequelize2.pool.read).to.be.instanceOf(Pool);
      expect(sequelize2.pool.write).to.be.instanceOf(Pool);
    });
  });

  describe('acquire', () => {
    let sequelize2: Sequelize;
    let sandbox: SinonSandbox;

    beforeEach(() => {
      const connection = {};
      sequelize2 = createSequelizeInstance({
        databaseVersion: sequelize.dialect.minimumDatabaseVersion,
      });
      sandbox = sinon.createSandbox();
      sandbox.stub(sequelize2.dialect.connectionManager, 'connect').resolves(connection);
      sandbox.stub(sequelize2.dialect.connectionManager, 'initializeConnection').resolves();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('allows the beforeConnect hook to modify the connection configuration', async () => {
      if (dialectName !== 'postgres') {
        return;
      }

      const user = Math.random().toString();
      const password = Math.random().toString();

      const typedSequelize = sequelize2 as Sequelize<PostgresDialect>;

      typedSequelize.hooks.addListener('beforeConnect', config => {
        config.user = user;
        config.password = password;
      });

      await sequelize2.pool.acquire();

      expect(sequelize2.dialect.connectionManager.connect).to.have.been.calledWith({
        ...sequelize2.options.replication.write,
        password,
        user,
      });
    });

    it('should call afterConnect', async () => {
      const spy = sinon.spy();
      sequelize2.hooks.addListener('afterConnect', spy);

      const connection = await sequelize2.pool.acquire();

      expect(spy.callCount).to.equal(1);
      expect(spy.firstCall.args[0]).to.equal(connection);
      expect(spy.firstCall.args[1]).to.deep.equal(sequelize2.options.replication.write);
    });

    it('awaits initializeConnection once, after connect and before the afterConnect hook', async () => {
      const { connectionManager } = sequelize2.dialect;
      const initializeConnection = connectionManager.initializeConnection as SinonStub;

      let initialized = false;
      initializeConnection.callsFake(async () => {
        // Yield to the event loop, so the hook can only see `initialized` if this was awaited
        await new Promise(resolve => {
          setImmediate(resolve);
        });
        initialized = true;
      });

      let initializedWhenHookRan: boolean | undefined;
      const afterConnect = sinon.spy(() => {
        initializedWhenHookRan = initialized;
      });
      sequelize2.hooks.addListener('afterConnect', afterConnect);

      await sequelize2.pool.acquire();

      const connection = await (connectionManager.connect as SinonStub).firstCall.returnValue;
      expect(initializeConnection).to.have.been.calledOnceWithExactly(sinon.match.same(connection));
      expect(initializeConnection).to.have.been.calledAfter(connectionManager.connect as SinonStub);
      expect(afterConnect).to.have.been.calledOnce;
      expect(initializedWhenHookRan).to.equal(true);
    });

    it('does not throw when pool.destroy is called during initializeConnection', async () => {
      let destroyError: unknown;

      const initializeConnection = sequelize2.dialect.connectionManager
        .initializeConnection as SinonStub;
      initializeConnection.callsFake(async connection => {
        try {
          await sequelize2.pool.destroy(connection);
        } catch (error) {
          destroyError = error;
        }
      });

      await sequelize2.pool.acquire();

      expect(destroyError).to.equal(undefined);
    });

    it('round robins calls to the read pool', async () => {
      // TODO https://github.com/sequelize/sequelize/issues/15150 - use pool ID instead
      const replica1Overrides: DialectConnectionConfigs = {
        postgres: {
          host: 'replica1',
        },
        mssql: {
          server: 'replica1',
        },
        mysql: {
          host: 'replica1',
        },
        sqlite3: {
          storage: getSqliteDatabasePath('replica1.db'),
        },
        db2: {
          database: 'replica1',
        },
        mariadb: {
          host: 'replica1',
        },
        ibmi: {
          dataSourceName: 'replica1',
        },
        snowflake: {
          account: 'replica1',
        },
        oracle: {
          host: 'replica1',
        },
      };

      const replica2Overrides: DialectConnectionConfigs = {
        postgres: {
          host: 'replica2',
        },
        mssql: {
          server: 'replica2',
        },
        mysql: {
          host: 'replica2',
        },
        sqlite3: {
          storage: getSqliteDatabasePath('replica2.db'),
        },
        db2: {
          database: 'replica2',
        },
        mariadb: {
          host: 'replica2',
        },
        ibmi: {
          dataSourceName: 'replica2',
        },
        snowflake: {
          account: 'replica2',
        },
        oracle: {
          host: 'replica2',
        },
      };

      const connectionOptions = sequelize.options.replication.write;
      const sequelize3 = createSequelizeInstance({
        pool: {
          max: 5,
        },
        replication: {
          write: connectionOptions,
          read: [
            { ...connectionOptions, ...replica1Overrides[dialectName] },
            { ...connectionOptions, ...replica2Overrides[dialectName] },
          ],
        },
      });

      const connectionManager = sequelize3.dialect.connectionManager;

      const connection = {};
      const connectStub = sandbox
        .stub(sequelize3.dialect.connectionManager, 'connect')
        .resolves(connection);

      sandbox.stub(connectionManager, 'initializeConnection').resolves();
      sandbox.stub(connectionManager, 'disconnect').resolves();
      sandbox
        .stub(sequelize3, 'fetchDatabaseVersion')
        .resolves(sequelize3.dialect.minimumDatabaseVersion);

      const getConnection = async () => {
        return sequelize3.pool.acquire({
          type: 'read',
          useMaster: false,
        });
      };

      await getConnection();
      await getConnection();
      await getConnection();
      expect(connectStub.callCount).to.equal(3);

      const calls = connectStub.getCalls();
      expect(calls[0].args[0]).to.deep.contain(replica1Overrides[dialectName]);
      expect(calls[1].args[0]).to.deep.contain(replica2Overrides[dialectName]);
      expect(calls[2].args[0]).to.deep.contain(replica1Overrides[dialectName]);
    });

    it('should allow forced reads from the write pool', async () => {
      const writeOverride: DialectConnectionConfigs = {
        postgres: {
          host: 'write',
        },
        mssql: {
          server: 'write',
        },
        mysql: {
          host: 'write',
        },
        sqlite3: {
          storage: getSqliteDatabasePath('write.db'),
        },
        db2: {
          database: 'write',
        },
        mariadb: {
          host: 'write',
        },
        ibmi: {
          dataSourceName: 'write',
        },
        snowflake: {
          account: 'write',
        },
        oracle: {
          host: 'write',
        },
      };

      const connectionOptions = sequelize.options.replication.write;
      const sequelize3 = createSequelizeInstance({
        databaseVersion: sequelize.dialect.minimumDatabaseVersion,
        replication: {
          write: { ...connectionOptions, ...writeOverride[dialectName] },
          read: [connectionOptions],
        },
      });

      const res: AbstractConnection = {};

      const connectionManager = sequelize3.dialect.connectionManager;
      const connectStub = sandbox.stub(connectionManager, 'connect').resolves(res);

      sandbox.stub(connectionManager, 'initializeConnection').resolves();
      sandbox.stub(connectionManager, 'disconnect').resolves();

      await sequelize3.pool.acquire({
        type: 'read',
        useMaster: true,
      });

      expect(connectStub).to.have.been.calledOnce;
      const calls = connectStub.getCalls();
      expect(calls[0].args[0]).to.deep.contain(writeOverride[dialectName]);
    });
  });

  describe('destroy', () => {
    let sequelize2: Sequelize;
    let connectStub: SinonStub;
    let initializeConnectionStub: SinonStub;
    let disconnectStub: SinonStub;

    beforeEach(() => {
      const connection = {};
      sequelize2 = createSequelizeInstance({
        databaseVersion: sequelize.dialect.minimumDatabaseVersion,
      });
      connectStub = sinon
        .stub(sequelize2.dialect.connectionManager, 'connect')
        .resolves(connection);
      disconnectStub = sinon.stub(sequelize2.dialect.connectionManager, 'disconnect');
      initializeConnectionStub = sinon
        .stub(sequelize2.dialect.connectionManager, 'initializeConnection')
        .resolves();
    });

    afterEach(() => {
      connectStub.reset();
      initializeConnectionStub.reset();
      disconnectStub.reset();
    });

    it('should call beforeDisconnect and afterDisconnect', async () => {
      const connection = await sequelize2.pool.acquire();

      const beforeDisconnect = sinon.spy();
      const afterDisconnect = sinon.spy();

      sequelize2.hooks.addListener('beforeDisconnect', beforeDisconnect);
      sequelize2.hooks.addListener('afterDisconnect', afterDisconnect);

      await sequelize2.pool.destroy(connection);

      expect(beforeDisconnect.callCount).to.equal(1);
      expect(beforeDisconnect.firstCall.args[0]).to.equal(connection);

      expect(afterDisconnect.callCount).to.equal(1);
      expect(afterDisconnect.firstCall.args[0]).to.equal(connection);
    });
  });
});
