import { Sequelize } from '@sequelize/core';
import { PostgresDialect } from '@sequelize/postgres';
import { expect } from 'chai';

describe('PostgresConnectionManager#connect', () => {
  class FakePgClient {
    static lastInstance: FakePgClient | null = null;
    static queryImpl: ((this: FakePgClient, sql: string) => Promise<unknown>) | null = null;

    readonly connectionConfig: unknown;
    readonly connection = {
      on() {},
      removeListener() {},
    };

    readonly queryCalls: string[] = [];
    endCalls = 0;

    constructor(connectionConfig: unknown) {
      this.connectionConfig = connectionConfig;
      FakePgClient.lastInstance = this;
    }

    connect(callback: (err?: Error | null) => void) {
      callback(null);
    }

    once() {}

    removeListener() {}

    on() {}

    async query(sql: string) {
      this.queryCalls.push(sql);

      if (FakePgClient.queryImpl) {
        return FakePgClient.queryImpl.call(this, sql);
      }

      return { rows: [] };
    }

    async end() {
      this.endCalls += 1;
    }
  }

  function createSequelize() {
    const fakePgModule = {
      Client: FakePgClient,
    } as any;

    return new Sequelize({
      dialect: PostgresDialect,
      pgModule: fakePgModule,
      timezone: 'Asia/Kolkata',
      keepDefaultTimezone: false,
      clientMinMessages: false,
      standardConformingStrings: false,
    });
  }

  beforeEach(() => {
    FakePgClient.lastInstance = null;
    FakePgClient.queryImpl = null;
  });

  it('runs timezone setup after connecting', async () => {
    const sequelize = createSequelize();
    const connection = await sequelize.dialect.connectionManager.connect({} as any);

    expect(connection).to.equal(FakePgClient.lastInstance);
    expect(FakePgClient.lastInstance?.queryCalls[0]).to.equal("SET TIME ZONE 'Asia/Kolkata';");
    expect(FakePgClient.lastInstance?.queryCalls[1]).to.include('WITH ranges AS');
    expect(FakePgClient.lastInstance?.endCalls).to.equal(0);
  });

  it('best-effort closes the connection when timezone setup fails', async () => {
    const sequelize = createSequelize();
    const queryError = new Error('post-connect setup failed');
    FakePgClient.queryImpl = async () => {
      throw queryError;
    };

    try {
      await sequelize.dialect.connectionManager.connect({} as any);
      throw new Error('Expected connect() to fail');
    } catch (error) {
      expect(error).to.equal(queryError);
    }

    expect(FakePgClient.lastInstance?.endCalls).to.equal(1);
    expect(FakePgClient.lastInstance?.queryCalls).to.deep.equal(["SET TIME ZONE 'Asia/Kolkata';"]);
  });

  it('best-effort closes the connection when OID refresh fails', async () => {
    const sequelize = createSequelize();
    const oidRefreshError = new Error('OID refresh failed');
    FakePgClient.queryImpl = async sql => {
      if (sql.includes('WITH ranges AS')) {
        throw oidRefreshError;
      }

      return { rows: [] };
    };

    try {
      await sequelize.dialect.connectionManager.connect({} as any);
      throw new Error('Expected connect() to fail');
    } catch (error) {
      expect(error).to.equal(oidRefreshError);
    }

    expect(FakePgClient.lastInstance?.endCalls).to.equal(1);
    expect(FakePgClient.lastInstance?.queryCalls[0]).to.equal("SET TIME ZONE 'Asia/Kolkata';");
    expect(FakePgClient.lastInstance?.queryCalls[1]).to.include('WITH ranges AS');
  });
});
