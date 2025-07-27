import type { Options } from '@sequelize/core';
import { ConnectionError, Sequelize } from '@sequelize/core';
import { MsSqlDialect } from '@sequelize/mssql';
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

  let config: Options<MsSqlDialect>;
  let instance: Sequelize<MsSqlDialect>;
  let Connection: Partial<TestConnection>;

  beforeEach(() => {
    Connection = {};

    const tediousModule = {
      Connection: function fakeConnection() {
        return Connection;
      },
    } as any;

    config = {
      dialect: MsSqlDialect,
      server: 'localhost',
      authentication: {
        type: 'default',
        options: {
          domain: 'TEST.COM',
          userName: 'none',
          password: 'none',
        },
      },
      pool: {},
      port: 2433,
      tediousModule,
    };

    instance = new Sequelize<MsSqlDialect>(config);
  });

  it('connectionManager.connect() should reject if end was called and connect was not', async () => {
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

    const error = await expect(instance.dialect.connectionManager.connect(config)).to.be.rejected;

    assert(error instanceof ConnectionError);
    expect(error.name).to.equal('SequelizeConnectionError');
    assert(error.cause instanceof Error);
    expect(error.cause.message).to.equal('Connection was closed by remote server');
  });

  it('connectionManager.connect() should call connect if state is initialized', async () => {
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

    await instance.dialect.connectionManager.connect(config);
    expect(connectStub.called).to.equal(true);
  });

  it('connectionManager.connect() should not fail with an instanceName but no port specified in config', async () => {
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

    config.instanceName = 'INSTANCENAME';

    await instance.dialect.connectionManager.connect(config);
    expect(connectStub.called).to.equal(true);
  });
});
