import type { AbstractConnection, AbstractDialect, Sequelize } from '@sequelize/core';
import { ConnectionError } from '@sequelize/core';
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
      sandbox.stub(sequelize2.dialect.connectionManager, 'validate').returns(true);
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
      sandbox.stub(connectionManager, 'validate').returns(true);
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
      sandbox.stub(connectionManager, 'validate').returns(true);
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

  describe('setup failure', () => {
    let sandbox: SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    function stubConnectionManager(sequelize2: Sequelize) {
      const connection = {};
      const { connectionManager } = sequelize2.dialect;

      return {
        connection,
        initializeConnection: sandbox.stub(connectionManager, 'initializeConnection').resolves(),
        validate: sandbox.stub(connectionManager, 'validate').returns(true),
        disconnect: sandbox.stub(connectionManager, 'disconnect').resolves(),
        connect: sandbox.stub(connectionManager, 'connect').resolves(connection),
      };
    }

    it('disconnects the connection if initializeConnection throws', async () => {
      const sequelize2 = createSequelizeInstance({
        databaseVersion: sequelize.dialect.minimumDatabaseVersion,
      });
      const stubs = stubConnectionManager(sequelize2);
      const setupError = new Error('setup failed');
      stubs.initializeConnection.rejects(setupError);

      await expect(sequelize2.pool.acquire()).to.be.rejectedWith(setupError);
      expect(stubs.disconnect).to.have.been.calledOnceWithExactly(
        sinon.match.same(stubs.connection),
      );
    });

    it('disconnects the connection if the afterConnect hook throws', async () => {
      const sequelize2 = createSequelizeInstance({
        databaseVersion: sequelize.dialect.minimumDatabaseVersion,
      });
      const stubs = stubConnectionManager(sequelize2);
      const hooks = spyOnDisconnectHooks(sequelize2);
      const setupError = new Error('hook failed');
      sequelize2.hooks.addListener('afterConnect', () => {
        throw setupError;
      });

      await expect(sequelize2.pool.acquire()).to.be.rejectedWith(setupError);
      expect(stubs.disconnect).to.have.been.calledOnceWithExactly(
        sinon.match.same(stubs.connection),
      );
      // The afterConnect hook did not complete
      expect(hooks.beforeDisconnect).not.to.have.been.called;
      expect(hooks.afterDisconnect).not.to.have.been.called;
    });

    it('disconnects the connection if fetching the database version fails', async () => {
      const sequelize2 = createSequelizeInstance();
      const stubs = stubConnectionManager(sequelize2);
      const setupError = new Error('version query failed');
      sandbox.stub(sequelize2, 'fetchDatabaseVersion').rejects(setupError);

      await expect(sequelize2.pool.acquire()).to.be.rejectedWith(setupError);
      expect(stubs.disconnect).to.have.been.calledOnceWithExactly(
        sinon.match.same(stubs.connection),
      );
    });

    function spyOnDisconnectHooks(sequelize2: Sequelize) {
      const beforeDisconnect = sinon.spy();
      const afterDisconnect = sinon.spy();
      sequelize2.hooks.addListener('beforeDisconnect', beforeDisconnect);
      sequelize2.hooks.addListener('afterDisconnect', afterDisconnect);

      return { beforeDisconnect, afterDisconnect };
    }

    it('runs the disconnect hooks if the afterConnect hook had run', async () => {
      const sequelize2 = createSequelizeInstance();
      const stubs = stubConnectionManager(sequelize2);
      const hooks = spyOnDisconnectHooks(sequelize2);
      const setupError = new Error('version query failed');
      sandbox.stub(sequelize2, 'fetchDatabaseVersion').rejects(setupError);

      await expect(sequelize2.pool.acquire()).to.be.rejectedWith(setupError);
      const connection = sinon.match.same(stubs.connection);
      expect(hooks.beforeDisconnect).to.have.been.calledOnceWithExactly(connection);
      expect(stubs.disconnect).to.have.been.calledOnceWithExactly(connection);
      expect(hooks.afterDisconnect).to.have.been.calledOnceWithExactly(connection);
    });

    it('does not run the disconnect hooks if the afterConnect hook had not run', async () => {
      const sequelize2 = createSequelizeInstance({
        databaseVersion: sequelize.dialect.minimumDatabaseVersion,
      });
      const stubs = stubConnectionManager(sequelize2);
      const hooks = spyOnDisconnectHooks(sequelize2);
      const setupError = new Error('setup failed');
      stubs.initializeConnection.rejects(setupError);

      await expect(sequelize2.pool.acquire()).to.be.rejectedWith(setupError);
      expect(stubs.disconnect).to.have.been.calledOnce;
      expect(hooks.beforeDisconnect).not.to.have.been.called;
      expect(hooks.afterDisconnect).not.to.have.been.called;
    });

    it('closes the connection even if a beforeDisconnect hook throws', async () => {
      const sequelize2 = createSequelizeInstance();
      const stubs = stubConnectionManager(sequelize2);
      const hooks = spyOnDisconnectHooks(sequelize2);
      sequelize2.hooks.addListener('beforeDisconnect', () => {
        throw new Error('beforeDisconnect failed');
      });
      const setupError = new Error('version query failed');
      sandbox.stub(sequelize2, 'fetchDatabaseVersion').rejects(setupError);

      await expect(sequelize2.pool.acquire()).to.be.rejectedWith(setupError);
      expect(stubs.disconnect).to.have.been.calledOnceWithExactly(
        sinon.match.same(stubs.connection),
      );
      expect(hooks.afterDisconnect).to.have.been.calledOnce;
    });

    it('rejects with the setup error if disconnecting also fails', async () => {
      const sequelize2 = createSequelizeInstance({
        databaseVersion: sequelize.dialect.minimumDatabaseVersion,
      });
      const stubs = stubConnectionManager(sequelize2);
      const setupError = new Error('setup failed');
      stubs.initializeConnection.rejects(setupError);
      stubs.disconnect.rejects(new Error('disconnect failed'));

      await expect(sequelize2.pool.acquire()).to.be.rejectedWith(setupError);
      expect(stubs.disconnect).to.have.been.calledOnce;
    });

    it('disconnects the connection if it broke during setup', async () => {
      const sequelize2 = createSequelizeInstance();
      const stubs = stubConnectionManager(sequelize2);
      const hooks = spyOnDisconnectHooks(sequelize2);
      // Breaks the connection during the last setup step, so the check must run after all of them.
      sandbox.stub(sequelize2, 'fetchDatabaseVersion').callsFake(async () => {
        // Simulates the dialect's error handler reacting to a lost connection.
        await sequelize2.pool.destroy(stubs.connection);
        stubs.validate.returns(false);

        return sequelize2.dialect.minimumDatabaseVersion;
      });

      await expect(sequelize2.pool.acquire()).to.be.rejectedWith(
        ConnectionError,
        'The new connection failed validation after it was set up',
      );
      const connection = sinon.match.same(stubs.connection);
      expect(stubs.validate).to.have.been.calledOnceWithExactly(connection);
      expect(stubs.disconnect).to.have.been.calledOnceWithExactly(connection);
      // The afterConnect hook had run
      expect(hooks.afterDisconnect).to.have.been.calledOnceWithExactly(connection);
    });

    it('uses the pool.validate option to check the connection after setup', async () => {
      const validate = sinon.stub().returns(false);
      const sequelize2 = createSequelizeInstance({
        databaseVersion: sequelize.dialect.minimumDatabaseVersion,
        pool: { validate },
      });
      const stubs = stubConnectionManager(sequelize2);

      await expect(sequelize2.pool.acquire()).to.be.rejectedWith(ConnectionError);
      expect(validate).to.have.been.calledOnceWithExactly(sinon.match.same(stubs.connection));
      expect(stubs.validate).not.to.have.been.called;
      expect(stubs.disconnect).to.have.been.calledOnceWithExactly(
        sinon.match.same(stubs.connection),
      );
    });

    it('does not disconnect the connection if setup succeeds', async () => {
      const sequelize2 = createSequelizeInstance({
        databaseVersion: sequelize.dialect.minimumDatabaseVersion,
      });
      const stubs = stubConnectionManager(sequelize2);

      expect(await sequelize2.pool.acquire()).to.equal(stubs.connection);
      expect(stubs.disconnect).not.to.have.been.called;
    });
  });

  describe('destroy', () => {
    let sequelize2: Sequelize;
    let connectStub: SinonStub;
    let initializeConnectionStub: SinonStub;
    let validateStub: SinonStub;
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
      validateStub = sinon.stub(sequelize2.dialect.connectionManager, 'validate').returns(true);
    });

    afterEach(() => {
      connectStub.reset();
      initializeConnectionStub.reset();
      validateStub.reset();
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
