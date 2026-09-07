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

const HSTORE_OID = 90_001;
const HSTORE_ARRAY_OID = 90_002;

async function buildConnectionManager() {
  const sequelize = new Sequelize({ dialect: PostgresDialect });

  (sequelize as { query: unknown }).query = async () => [
    { rows: [{ typname: 'hstore', typtype: 'b', oid: HSTORE_OID, typarray: HSTORE_ARRAY_OID }] },
  ];

  await sequelize.dialect.connectionManager.refreshDynamicOids();

  return sequelize.dialect.connectionManager;
}

describe('PostgresConnectionManager#getTypeParser', () => {
  it('returns the dialect parser for a type it knows', async () => {
    const connectionManager = await buildConnectionManager();

    expect(connectionManager.getTypeParser(HSTORE_OID, 'text')('"a"=>"b"')).to.deep.equal({
      a: 'b',
    });
  });

  it('caches parsers per type', async () => {
    const connectionManager = await buildConnectionManager();

    expect(connectionManager.getTypeParser(HSTORE_OID, 'text')).to.equal(
      connectionManager.getTypeParser(HSTORE_OID, 'text'),
    );
  });

  it('treats an omitted format as the text format', async () => {
    const connectionManager = await buildConnectionManager();

    expect(connectionManager.getTypeParser(HSTORE_OID)).to.equal(
      connectionManager.getTypeParser(HSTORE_OID, 'text'),
    );
  });

  it('does not hand out a text parser for the binary format', async () => {
    const connectionManager = await buildConnectionManager();

    const textParser = connectionManager.getTypeParser(HSTORE_OID, 'text');
    const binaryParser = connectionManager.getTypeParser(HSTORE_OID, 'binary');

    expect(binaryParser).to.not.equal(textParser);
    expect(binaryParser(Buffer.from('"a"=>"b"'))).to.equal('"a"=>"b"');
  });

  it('does not hand out a binary parser for the text format', async () => {
    const connectionManager = await buildConnectionManager();

    const binaryParser = connectionManager.getTypeParser(HSTORE_OID, 'binary');
    const textParser = connectionManager.getTypeParser(HSTORE_OID, 'text');

    expect(textParser).to.not.equal(binaryParser);
    expect(textParser('"a"=>"b"')).to.deep.equal({ a: 'b' });
  });

  it('parses arrays with the text parser of their base type', async () => {
    const connectionManager = await buildConnectionManager();

    expect(
      connectionManager.getTypeParser(HSTORE_ARRAY_OID, 'text')('{"\\"a\\"=>\\"b\\""}'),
    ).to.deep.equal([{ a: 'b' }]);
  });
});
