import { Sequelize } from '@sequelize/core';
import { SnowflakeDialect } from '@sequelize/snowflake';
import { expect } from 'chai';
import sinon from 'sinon';

describe('SnowflakeConnectionManager#connect', () => {
  let originalWarn = console.warn;

  interface ExecuteOptions {
    sqlText: string;
    complete(err?: Error): void;
  }

  class FakeSnowflakeConnection {
    static lastInstance: FakeSnowflakeConnection | null = null;
    static executeImpl: ((this: FakeSnowflakeConnection, options: ExecuteOptions) => void) | null =
      null;

    static destroyImpl: ((this: FakeSnowflakeConnection, callback: () => void) => void) | null =
      null;

    readonly connectionConfig: unknown;
    readonly executeCalls: string[] = [];
    destroyCalls = 0;

    constructor(connectionConfig: unknown) {
      this.connectionConfig = connectionConfig;
      FakeSnowflakeConnection.lastInstance = this;
    }

    connect(callback: (err?: Error | null) => void) {
      callback(null);
    }

    execute(options: ExecuteOptions) {
      this.executeCalls.push(options.sqlText);

      if (FakeSnowflakeConnection.executeImpl) {
        FakeSnowflakeConnection.executeImpl.call(this, options);

        return;
      }

      options.complete();
    }

    destroy(callback: () => void) {
      this.destroyCalls += 1;

      if (FakeSnowflakeConnection.destroyImpl) {
        FakeSnowflakeConnection.destroyImpl.call(this, callback);

        return;
      }

      callback();
    }

    isUp() {
      return true;
    }

    getId() {
      return 'fake-connection-id';
    }
  }

  function createSequelize() {
    const fakeSnowflakeSdk = {
      createConnection(connectionConfig: unknown) {
        return new FakeSnowflakeConnection(connectionConfig);
      },
    } as any;

    return new Sequelize({
      dialect: SnowflakeDialect,
      snowflakeSdkModule: fakeSnowflakeSdk,
      timezone: 'America/Los_Angeles',
      keepDefaultTimezone: false,
    });
  }

  beforeEach(() => {
    originalWarn = console.warn;
    console.warn = () => {};

    FakeSnowflakeConnection.lastInstance = null;
    FakeSnowflakeConnection.executeImpl = null;
    FakeSnowflakeConnection.destroyImpl = null;
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  it('runs timezone setup after connecting', async () => {
    const sequelize = createSequelize();

    const connection = await sequelize.dialect.connectionManager.connect({} as any);

    expect(connection).to.equal(FakeSnowflakeConnection.lastInstance);
    expect(FakeSnowflakeConnection.lastInstance?.executeCalls).to.deep.equal([
      "ALTER SESSION SET timezone = 'America/Los_Angeles'",
    ]);
    expect(FakeSnowflakeConnection.lastInstance?.destroyCalls).to.equal(0);
  });

  it('best-effort destroys the connection when timezone setup fails', async () => {
    const sequelize = createSequelize();
    FakeSnowflakeConnection.executeImpl = options => {
      options.complete(new Error('timezone setup failed'));
    };

    try {
      await sequelize.dialect.connectionManager.connect({} as any);
      throw new Error('Expected connect() to fail');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal('timezone setup failed');
    }

    expect(FakeSnowflakeConnection.lastInstance?.executeCalls).to.deep.equal([
      "ALTER SESSION SET timezone = 'America/Los_Angeles'",
    ]);
    expect(FakeSnowflakeConnection.lastInstance?.destroyCalls).to.equal(1);
  });

  it('best-effort destroys the connection when timezone validation fails', async () => {
    const sequelize = new Sequelize({
      dialect: SnowflakeDialect,
      snowflakeSdkModule: {
        createConnection(connectionConfig: unknown) {
          return new FakeSnowflakeConnection(connectionConfig);
        },
      } as any,
      timezone: '+05:30',
      keepDefaultTimezone: false,
    });

    try {
      await sequelize.dialect.connectionManager.connect({} as any);
      throw new Error('Expected connect() to fail');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal(
        'Snowflake only supports named timezones for the sequelize "timezone" option.',
      );
    }

    expect(FakeSnowflakeConnection.lastInstance?.executeCalls).to.deep.equal([]);
    expect(FakeSnowflakeConnection.lastInstance?.destroyCalls).to.equal(1);
  });

  it('does not hang if setup cleanup destroy callback never fires', async () => {
    const clock = sinon.useFakeTimers();
    const sequelize = createSequelize();
    const setupError = new Error('timezone setup failed');

    FakeSnowflakeConnection.executeImpl = options => {
      options.complete(setupError);
    };

    FakeSnowflakeConnection.destroyImpl = () => {};

    try {
      const connectPromise = sequelize.dialect.connectionManager
        .connect({} as any)
        .catch(error => error);
      await clock.tickAsync(5000);

      expect(await connectPromise).to.equal(setupError);
      expect(FakeSnowflakeConnection.lastInstance?.destroyCalls).to.equal(1);
    } finally {
      clock.restore();
    }
  });
});
