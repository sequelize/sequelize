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
      domain: 'TEST.COM',
      host: 'localhost',
      password: 'none',
      pool: {},
      port: 2433,
      tediousModule,
      username: 'none',
    };

    instance = new Sequelize(config);
  });

  it('connectionManager._connect() does not delete `domain` from config', async () => {
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

    expect(config.domain).to.equal('TEST.COM');
    // @ts-expect-error -- protected method
    await instance.dialect.connectionManager._connect(config);
    expect(config.domain).to.equal('TEST.COM');
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
