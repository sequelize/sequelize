import { Sequelize } from '@sequelize/core';
import { PostgresDialect } from '@sequelize/postgres';
import { expect } from 'chai';
import { EventEmitter } from 'node:events';

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

class FakePgClient extends EventEmitter {
  // connect() listens to the protocol connection for server parameters.
  readonly connection = new EventEmitter();

  connect(callback: (error: Error | null) => void) {
    process.nextTick(() => {
      callback(null);
    });
  }

  async query() {
    return { rows: [] };
  }
}

describe('PostgresConnectionManager#initializeConnection', () => {
  it('only replaces the placeholder error listener', async () => {
    const sequelize = new Sequelize({
      dialect: PostgresDialect,
      pgModule: { Client: FakePgClient } as any,
    });
    const { connectionManager } = sequelize.dialect;

    const connection = await connectionManager.connect({});
    const otherListener = () => {};

    connection.on('error', otherListener);
    expect(connection.listenerCount('error')).to.equal(2);

    await connectionManager.initializeConnection(connection);

    const listeners = connection.listeners('error');
    expect(listeners).to.have.length(2);
    expect(listeners).to.include(otherListener);

    // The other listener is the real handler, which destroys the connection.
    const destroyed: unknown[] = [];
    Object.assign(sequelize.pool, {
      async destroy(destroyedConnection: unknown) {
        destroyed.push(destroyedConnection);
      },
    });
    connection.emit('error', Object.assign(new Error('connection lost'), { code: 'ECONNRESET' }));
    expect(destroyed).to.have.length(1);
    expect(destroyed[0]).to.equal(connection);
  });
});
