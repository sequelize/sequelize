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

      if (sequelize2.dialect.connectionManager.afterConnect) {
        sandbox.stub(sequelize2.dialect.connectionManager, 'afterConnect').resolves();
      }
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

    it('does not throw when pool.destroy is called during the afterConnect hook', async () => {
      // Regression test for https://github.com/sequelize/sequelize/issues/9242
      //
      // Dialect connection managers attach an error handler inside connect() that calls
      // pool.destroy(connection) when a DB error occurs. If an error fires during the
      // connection setup phase (before the connection is registered in owningPools),
      // pool.destroy() would throw "Unable to determine to which pool the connection belongs",
      // causing an unhandled rejection that can crash the process.
      //
      // The fix is calling owningPools.set() before connection setup code (including the error
      // handler attachment) runs, so that if pool.destroy() is called it finds the connection.
      let destroyError: unknown;

      sequelize2.hooks.addListener('afterConnect', async connection => {
        // Simulate the dialect's error handler calling pool.destroy() during setup
        try {
          await sequelize2.pool.destroy(connection);
        } catch (error) {
          destroyError = error;
        }
      });

      await sequelize2.pool.acquire();

      expect(destroyError, 'pool.destroy() must not throw during afterConnect').to.equal(undefined);
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

      if (connectionManager.afterConnect) {
        sandbox.stub(connectionManager, 'afterConnect').resolves();
      }

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

      if (connectionManager.afterConnect) {
        sandbox.stub(connectionManager, 'afterConnect').resolves();
      }

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
    let afterConnectStub: SinonStub;
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

      if (sequelize2.dialect.connectionManager.afterConnect) {
        afterConnectStub = sinon
          .stub(sequelize2.dialect.connectionManager, 'afterConnect')
          .resolves();
      }
    });

    afterEach(() => {
      connectStub.reset();
      afterConnectStub?.reset();
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
