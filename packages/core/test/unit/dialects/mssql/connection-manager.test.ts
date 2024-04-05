import type { Options } from '@sequelize/core';
import { ConnectionError, Sequelize } from '@sequelize/core';
import type { MsSqlDialect } from '@sequelize/mssql';
import type { RequiredBy } from '@sequelize/utils';
import { assert, expect } from 'chai';
import sinon from 'sinon';
import { Connection as TediousConnection } from 'tedious';
import { getTestDialect } from '../../../support';

const dialect = getTestDialect();

type TestConnection = Omit<TediousConnection, 'once' | 'removeListener' | 'on'> & {
  once(event: string, cb: () => void): void;
  removeListener(): void;
  on(): void;
};

describe('[MSSQL Specific] Connection Manager', () => {
  if (dialect !== 'mssql') {
    return;
  }

  let config: RequiredBy<Options<MsSqlDialect>, 'dialectOptions'>;
  let instance: Sequelize<MsSqlDialect>;
  let Connection: Partial<TestConnection>;
  let connectionStub: sinon.SinonStub;

  beforeEach(() => {
    config = {
      dialect: 'mssql',
      database: 'none',
      username: 'none',
      password: 'none',
      host: 'localhost',
      port: 2433,
      pool: {},
      dialectOptions: {
        domain: 'TEST.COM',
      },
    };
    instance = new Sequelize(config);
    Connection = {};
    // @ts-expect-error -- lib is private
    connectionStub = sinon.stub(instance.connectionManager, 'lib').value({
      Connection: function fakeConnection() {
        return Connection;
      },
    });
  });

  afterEach(() => {
    connectionStub.restore();
  });

  it('connectionManager._connect() does not delete `domain` from config.dialectOptions', async () => {
    Connection = {
      STATE: TediousConnection.prototype.STATE,
      state: undefined,
      once: (event, cb) => {
        if (event === 'connect') {
          setTimeout(() => {
            cb();
          }, 500);
        }
      },
      removeListener: () => {},
      on: () => {},
    };

    expect(config.dialectOptions.domain).to.equal('TEST.COM');
    // @ts-expect-error -- protected method
    await instance.dialect.connectionManager._connect(config);
    expect(config.dialectOptions.domain).to.equal('TEST.COM');
  });

  it('connectionManager._connect() should reject if end was called and connect was not', async () => {
    Connection = {
      STATE: TediousConnection.prototype.STATE,
      state: undefined,
      once(event, cb) {
        if (event === 'end') {
          setTimeout(() => {
            cb();
          }, 500);
        }
      },
      removeListener: () => {},
      on: () => {},
    };

    try {
      // @ts-expect-error -- protected method
      await instance.dialect.connectionManager._connect(config);
      assert.fail('Expected an error to be thrown');
    } catch (error) {
      assert(error instanceof ConnectionError);
      expect(error.name).to.equal('SequelizeConnectionError');
      assert(error.cause instanceof Error);
      expect(error.cause.message).to.equal('Connection was closed by remote server');
    }
  });

  it('connectionManager._connect() should call connect if state is initialized', async () => {
    const connectStub = sinon.stub();
    Connection = {
      STATE: TediousConnection.prototype.STATE,
      state: TediousConnection.prototype.STATE.INITIALIZED,
      connect: connectStub,
      once(event, cb) {
        if (event === 'connect') {
          setTimeout(() => {
            cb();
          }, 500);
        }
      },
      removeListener: () => {},
      on: () => {},
    };

    // @ts-expect-error -- protected method
    await instance.dialect.connectionManager._connect(config);
    expect(connectStub.called).to.equal(true);
  });
});
